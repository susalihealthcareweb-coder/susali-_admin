import { prisma } from "@/lib/prisma";
import { route, ok } from "@/lib/api";
import { checkCron } from "@/lib/cron";
import { overdue } from "@/lib/dashboard";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";

const STAGES = {
  submitted: { text: "waiting in the Verification Queue", limit: (s) => `${s.submittedLimitWorkingHours} working hours` },
  forwarded: { text: "forwarded without hospital acceptance", limit: (s) => `${s.forwardedLimitHours} hours` },
  accepted: { text: "accepted without a patient visit", limit: (s) => `${s.acceptedLimitHours} hours` },
  visited: { text: "visited without completion", limit: (s) => `${s.visitedLimitDays} days` },
};

// Raises each time-limit escalation once per stage, and auto-closes
// completed referrals after the configured number of days.
export const GET = route(async (req) => {
  checkCron(req);
  const od = await overdue();
  const s = od.settings;
  let raised = 0;
  for (const stage of Object.keys(STAGES)) {
    const ids = od[stage];
    if (!ids.length) continue;
    const refs = await prisma.referral.findMany({ where: { id: { in: ids } }, include: { employee: true, hospital: true } });
    for (const r of refs) {
      if (r.escalations.includes(stage)) continue;
      await prisma.referral.update({ where: { id: r.id }, data: { escalations: { push: stage } } });
      await notify("ESCALATION", { referral: r, extra: { stageText: STAGES[stage].text, limitText: STAGES[stage].limit(s) } });
      raised++;
    }
  }

  const cutoff = new Date(Date.now() - s.autoCloseDays * 86400000);
  const toClose = await prisma.referral.findMany({ where: { status: "COMPLETED", completedAt: { lt: cutoff } }, select: { id: true } });
  for (const r of toClose) {
    const res = await prisma.referral.updateMany({ where: { id: r.id, status: "COMPLETED" }, data: { status: "CLOSED", closedAt: new Date() } });
    if (res.count) {
      await prisma.referralStatusHistory.create({ data: { referralId: r.id, fromStatus: "COMPLETED", toStatus: "CLOSED", remarks: `Auto-closed after ${s.autoCloseDays} days` } });
      await audit({ actorRole: "SYSTEM", action: "AUTO_CLOSE", entity: "Referral", entityId: r.id });
    }
  }
  return ok({ escalated: raised, autoClosed: toClose.length });
});

import { prisma } from "./prisma";
import { overdue } from "./dashboard";
import { notify, processQueue } from "./notify";
import { audit } from "./audit";

const STAGES = {
  submitted: { text: "waiting in the Verification Queue", limit: (s) => `${s.submittedLimitWorkingHours} working hours` },
  forwarded: { text: "forwarded without hospital acceptance", limit: (s) => `${s.forwardedLimitHours} hours` },
  accepted: { text: "accepted without a patient visit", limit: (s) => `${s.acceptedLimitHours} hours` },
  visited: { text: "visited without completion", limit: (s) => `${s.visitedLimitDays} days` },
};

// Raises each time-limit escalation once per stage, and auto-closes
// completed referrals after the configured number of days.
// Raises each time-limit escalation once per stage, and auto-closes
// completed referrals after the configured number of days.
export async function runEscalations() {
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
  return { escalated: raised, autoClosed: toClose.length };
}

export const runNotifications = (limit = 200) => processQueue(limit);

// Claims a job slot in the database so that, across all servers, a job runs
// at most once per `everyMinutes`. Returns true for the one caller that wins.
async function claim(job, everyMinutes) {
  const id = `job:${job}`;
  const nowMin = Math.floor(Date.now() / 60000);
  await prisma.counter.upsert({ where: { id }, create: { id, seq: 0 }, update: {} }).catch(() => {});
  const r = await prisma.counter.updateMany({ where: { id, seq: { lte: nowMin - everyMinutes } }, data: { seq: nowMin } });
  return r.count === 1;
}

// Vercel's Hobby plan only allows daily cron jobs, so frequent work also runs
// in the background after ordinary requests when it is due: queued WhatsApp /
// email retries every minute, time-limit escalations every 15 minutes.
export async function runDueJobs() {
  try {
    if (await claim("notifications", 1)) await runNotifications(100);
    if (await claim("escalations", 15)) await runEscalations();
  } catch (e) {
    console.error("background jobs", e);
  }
}

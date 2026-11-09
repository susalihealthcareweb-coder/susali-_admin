import { prisma } from "@/lib/prisma";
import { route, ok } from "@/lib/api";
import { checkCron } from "@/lib/cron";
import { kickQueue } from "@/lib/notify";
import { STATUS, OPEN_STATUSES } from "@/lib/constants";

// Daily 9 AM IST email to Cluster Managers, Support, admins and hospitals.
export const GET = route(async (req) => {
  checkCron(req);
  const since = new Date(Date.now() - 24 * 3600000);
  const app = (process.env.APP_URL || "").replace(/\/$/, "");
  const users = await prisma.user.findMany({ where: { isActive: true, muteEmail: false } });
  const rows = [];

  async function counts(where) {
    const [newRefs, open, grouped] = await Promise.all([
      prisma.referral.count({ where: { ...where, submittedAt: { gte: since } } }),
      prisma.referral.count({ where: { ...where, status: { in: OPEN_STATUSES } } }),
      prisma.referral.groupBy({ by: ["status"], where: { ...where, status: { in: OPEN_STATUSES } }, _count: { _all: true } }),
    ]);
    return [["New in last 24 hours", newRefs], ["Open referrals", open], ...grouped.map((g) => [STATUS[g.status].label, g._count._all])];
  }

  const cache = new Map();
  for (const u of users) {
    let where;
    if (u.role === "CLUSTER_MANAGER") where = { clusterId: { in: u.clusterIds } };
    else if (u.role === "HOSPITAL_USER") where = { hospitalId: u.hospitalId };
    else where = {};
    const key = JSON.stringify(where);
    if (!cache.has(key)) cache.set(key, await counts(where));
    const table = cache.get(key);
    rows.push({
      event: "DAILY_SUMMARY", channel: "EMAIL", userId: u.id, recipient: u.email,
      title: "Daily referral summary", body: "Here is today's SUSALI summary for your scope.",
      payload: { rows: table, link: app + "/login" }, status: "QUEUED",
    });
  }
  if (rows.length) await prisma.notification.createMany({ data: rows });
  kickQueue();
  return ok({ queued: rows.length });
});

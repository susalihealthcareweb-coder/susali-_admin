import { prisma } from "./prisma";
import { OPEN_STATUSES, PIPELINE } from "./constants";
import { getSettings, workingHoursBetween } from "./settings";

const startOfTodayIST = () => {
  const now = new Date(Date.now() + 5.5 * 3600000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 5.5 * 3600000);
};
const startOfMonthIST = () => {
  const now = new Date(Date.now() + 5.5 * 3600000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 5.5 * 3600000);
};

async function groupCount(by, where) {
  const g = await prisma.referral.groupBy({ by: [by], where, _count: { _all: true } });
  return Object.fromEntries(g.map((x) => [x[by] ?? "none", x._count._all]));
}

async function avgHours(fromField, toField, where = {}) {
  const rows = await prisma.referral.findMany({
    where: { ...where, [fromField]: { not: null }, [toField]: { not: null } },
    select: { [fromField]: true, [toField]: true },
    orderBy: { [toField]: "desc" },
    take: 2000,
  });
  if (!rows.length) return null;
  const sum = rows.reduce((s, r) => s + (r[toField] - r[fromField]), 0);
  return sum / rows.length / 3600000;
}

// Referrals past their time limit, grouped by stage.
export async function overdue(scope = {}) {
  const s = await getSettings();
  const now = Date.now();
  const hrs = (h) => new Date(now - h * 3600000);
  const [submittedCandidates, forwarded, accepted, visited] = await Promise.all([
    prisma.referral.findMany({ where: { ...scope, status: "SUBMITTED", submittedAt: { lt: hrs(s.submittedLimitWorkingHours) } }, select: { id: true, submittedAt: true } }),
    prisma.referral.findMany({ where: { ...scope, status: "FORWARDED", forwardedAt: { lt: hrs(s.forwardedLimitHours) } }, select: { id: true } }),
    prisma.referral.findMany({ where: { ...scope, status: "ACCEPTED", acceptedAt: { lt: hrs(s.acceptedLimitHours) } }, select: { id: true } }),
    prisma.referral.findMany({ where: { ...scope, status: { in: ["VISITED", "UNDER_TREATMENT"] }, visitedAt: { lt: hrs(s.visitedLimitDays * 24) } }, select: { id: true } }),
  ]);
  const submitted = submittedCandidates.filter((r) => workingHoursBetween(r.submittedAt, new Date(), s) > s.submittedLimitWorkingHours);
  return {
    settings: s,
    submitted: submitted.map((r) => r.id),
    forwarded: forwarded.map((r) => r.id),
    accepted: accepted.map((r) => r.id),
    visited: visited.map((r) => r.id),
  };
}

export async function adminDashboard() {
  const today = startOfTodayIST();
  const month = startOfMonthIST();
  const notDraft = { status: { not: "DRAFT" } };
  const [clusters, companies, employees, hospitals, refToday, refMonth, open, completed, byStatus, od] = await Promise.all([
    prisma.cluster.count({ where: { isActive: true } }),
    prisma.company.count({ where: { isActive: true } }),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.hospital.count({ where: { isActive: true } }),
    prisma.referral.count({ where: { ...notDraft, submittedAt: { gte: today } } }),
    prisma.referral.count({ where: { ...notDraft, submittedAt: { gte: month } } }),
    prisma.referral.count({ where: { status: { in: OPEN_STATUSES } } }),
    prisma.referral.count({ where: { status: { in: ["COMPLETED", "CLOSED"] } } }),
    groupCount("status", notDraft),
    overdue(),
  ]);
  const [tVerify, tVisit, tComplete] = await Promise.all([
    avgHours("submittedAt", "forwardedAt"),
    avgHours("forwardedAt", "visitedAt"),
    avgHours("visitedAt", "completedAt"),
  ]);
  return {
    cards: { clusters, companies, employees, hospitals, refToday, refMonth, open, completed },
    pipeline: PIPELINE.map((s) => ({ status: s, count: byStatus[s] || 0 })),
    byStatus,
    turnaround: { verify: tVerify, visit: tVisit, complete: tComplete },
    overdue: od,
  };
}

export async function chartData(where = {}) {
  const base = { ...where, status: { not: "DRAFT" } };
  const since = new Date();
  since.setMonth(since.getMonth() - 11, 1);
  since.setHours(0, 0, 0, 0);
  const recent = await prisma.referral.findMany({ where: { ...base, submittedAt: { gte: since } }, select: { submittedAt: true } });
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(since);
    d.setMonth(since.getMonth() + i);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleString("en-IN", { month: "short" }), count: 0 });
  }
  for (const r of recent) {
    const k = `${r.submittedAt.getFullYear()}-${String(r.submittedAt.getMonth() + 1).padStart(2, "0")}`;
    const m = months.find((x) => x.key === k);
    if (m) m.count++;
  }
  const [byCluster, byCompany, byHospital, byDept, rejected] = await Promise.all([
    groupCount("clusterId", base),
    groupCount("companyId", base),
    groupCount("hospitalId", base),
    groupCount("departmentId", base),
    prisma.referral.findMany({ where: { ...where, rejectReason: { not: null } }, select: { rejectReason: true } }),
  ]);
  const names = async (model, map) => {
    const ids = Object.keys(map).filter((k) => k !== "none");
    const rows = await prisma[model].findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const n = Object.fromEntries(rows.map((r) => [r.id, r.name]));
    return Object.entries(map)
      .filter(([k]) => k !== "none")
      .map(([k, v]) => ({ label: n[k] || "Unknown", count: v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  };
  const reasons = {};
  for (const r of rejected) {
    const k = r.rejectReason.split(":")[0].trim();
    reasons[k] = (reasons[k] || 0) + 1;
  }
  return {
    months,
    cluster: await names("cluster", byCluster),
    company: await names("company", byCompany),
    hospital: await names("hospital", byHospital),
    department: await names("department", byDept),
    rejection: Object.entries(reasons).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
  };
}

export async function hospitalPerformance() {
  const hospitals = await prisma.hospital.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  const out = [];
  for (const h of hospitals) {
    const where = { hospitalId: h.id };
    const [acc, dec, pendingDocs, avgDone] = await Promise.all([
      prisma.referral.count({ where: { ...where, acceptedAt: { not: null } } }),
      // Each decline writes an audit row against the hospital, since the
      // referral itself moves on to another hospital.
      prisma.auditLog.count({ where: { entity: "Hospital", entityId: h.id, action: "REFERRAL_DECLINED" } }),
      prisma.referral.count({ where: { ...where, status: { in: ["VISITED", "UNDER_TREATMENT"] } } }),
      avgHours("acceptedAt", "completedAt", where),
    ]);
    out.push({ ...h, accepted: acc, declined: dec, pendingDocs, avgCompletion: avgDone });
  }
  return out.sort((a, b) => b.accepted - a.accepted);
}

export async function supportDashboard(me) {
  const today = startOfTodayIST();
  const s = await getSettings();
  const followCut = new Date(Date.now() - s.followUpForwardedHours * 3600000);
  const visitCut = new Date(Date.now() - s.visitedLimitDays * 86400000);
  const [queue, mine, forwardedToday, info, declined, followForward, followVisit] = await Promise.all([
    prisma.referral.count({ where: { status: { in: ["SUBMITTED", "HOSPITAL_DECLINED"] } } }),
    prisma.referral.count({ where: { status: "UNDER_VERIFICATION", lockedById: me.id } }),
    prisma.referralStatusHistory.count({ where: { toStatus: "FORWARDED", actorUserId: me.id, createdAt: { gte: today } } }),
    prisma.referral.count({ where: { status: "INFO_REQUESTED" } }),
    prisma.referral.count({ where: { status: "HOSPITAL_DECLINED" } }),
    prisma.referral.count({ where: { status: { in: ["FORWARDED", "ACCEPTED"] }, forwardedAt: { lt: followCut } } }),
    prisma.referral.count({ where: { status: { in: ["VISITED", "UNDER_TREATMENT"] }, visitedAt: { lt: visitCut } } }),
  ]);
  return { queue, mine, forwardedToday, info, declined, followForward, followVisit, settings: s };
}

export async function clusterDashboard(me) {
  const month = startOfMonthIST();
  const scope = { clusterId: { in: me.clusterIds } };
  const companyIds = (await prisma.company.findMany({ where: scope, select: { id: true } })).map((c) => c.id);
  const [companies, employees, refMonth, open, byStatus] = await Promise.all([
    prisma.company.count({ where: { ...scope, isActive: true } }),
    prisma.employee.count({ where: { companyId: { in: companyIds }, isActive: true } }),
    prisma.referral.count({ where: { ...scope, status: { not: "DRAFT" }, submittedAt: { gte: month } } }),
    prisma.referral.count({ where: { ...scope, status: { in: OPEN_STATUSES } } }),
    groupCount("status", { ...scope, status: { not: "DRAFT" } }),
  ]);
  return { companies, employees, refMonth, open, byStatus };
}

export async function hospitalDashboard(me) {
  const where = { hospitalId: me.hospitalId };
  const [incoming, expected, inProgress, completed] = await Promise.all([
    prisma.referral.count({ where: { ...where, status: "FORWARDED" } }),
    prisma.referral.count({ where: { ...where, status: "ACCEPTED" } }),
    prisma.referral.count({ where: { ...where, status: { in: ["VISITED", "UNDER_TREATMENT"] } } }),
    prisma.referral.count({ where: { ...where, status: { in: ["COMPLETED", "CLOSED"] } } }),
  ]);
  return { incoming, expected, inProgress, pendingDocs: inProgress, completed };
}

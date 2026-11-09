import { prisma } from "./prisma";
import { referralScope } from "./scope";
import { URGENCY } from "./constants";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Builds a scoped, searchable referral filter.
export async function referralWhere(me, { status, q, hospitalId, clusterId, companyId, from, to, extra } = {}) {
  const and = [referralScope(me)];
  if (status) {
    const list = Array.isArray(status) ? status : String(status).split(",").filter(Boolean);
    if (list.length) and.push({ status: { in: list } });
  }
  if (hospitalId) and.push({ hospitalId });
  if (clusterId) and.push({ clusterId });
  if (companyId) and.push({ companyId });
  if (from) and.push({ createdAt: { gte: new Date(from) } });
  if (to) and.push({ createdAt: { lte: new Date(new Date(to).getTime() + 86400000 - 1) } });
  if (extra) and.push(extra);
  const term = String(q || "").trim();
  if (term) {
    const rx = { contains: term, mode: "insensitive" };
    const [emps, comps] = await Promise.all([
      prisma.employee.findMany({
        where: { OR: [{ fullName: rx }, { mobile: { contains: term.replace(/\D/g, "") || term } }, { employeeCode: rx }] },
        select: { id: true },
        take: 500,
      }),
      prisma.company.findMany({ where: { OR: [{ name: rx }, { code: rx }] }, select: { id: true }, take: 200 }),
    ]);
    and.push({
      OR: [
        { referralNo: { contains: term.toUpperCase() } },
        { patientName: { contains: term, mode: "insensitive" } },
        { employeeId: { in: emps.map((e) => e.id) } },
        { companyId: { in: comps.map((c) => c.id) } },
      ],
    });
  }
  return { AND: and };
}

export const listInclude = {
  employee: { select: { id: true, fullName: true, employeeCode: true, mobile: true } },
  familyMember: { select: { fullName: true, relation: true } },
  hospital: { select: { id: true, name: true } },
  department: { select: { name: true } },
  lockedBy: { select: { id: true, name: true } },
};

export async function listReferrals(me, opts = {}, { page = 1, take = 20, orderBy } = {}) {
  const where = await referralWhere(me, opts);
  const [rows, total] = await Promise.all([
    prisma.referral.findMany({
      where,
      include: listInclude,
      orderBy: orderBy || { updatedAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    prisma.referral.count({ where }),
  ]);
  const companyIds = [...new Set(rows.map((r) => r.companyId))];
  const companies = await prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } });
  const cmap = Object.fromEntries(companies.map((c) => [c.id, c.name]));
  return { rows: rows.map((r) => ({ ...r, companyName: cmap[r.companyId] || "" })), total, page, pages: Math.max(1, Math.ceil(total / take)) };
}

// Verification Queue: oldest and most urgent first.
export async function verificationQueue(me) {
  const rows = await prisma.referral.findMany({
    where: { status: { in: ["SUBMITTED", "HOSPITAL_DECLINED", "UNDER_VERIFICATION"] } },
    include: listInclude,
    orderBy: { submittedAt: "asc" },
    take: 200,
  });
  rows.sort((a, b) => URGENCY[a.urgency].rank - URGENCY[b.urgency].rank || (a.submittedAt || a.createdAt) - (b.submittedAt || b.createdAt));
  const companies = await prisma.company.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.companyId))] } }, select: { id: true, name: true } });
  const cmap = Object.fromEntries(companies.map((c) => [c.id, c.name]));
  return rows.map((r) => ({ ...r, companyName: cmap[r.companyId] || "" }));
}

export async function referralDetail(id) {
  return prisma.referral.findUnique({
    where: { id },
    include: {
      employee: { include: { company: { select: { id: true, name: true, code: true } } } },
      familyMember: true,
      hospital: true,
      department: true,
      dispensary: true,
      superintendentHospital: true,
      lockedBy: { select: { id: true, name: true } },
      verifiedBy: { select: { id: true, name: true } },
      raisedBy: { select: { id: true, name: true } },
      history: { orderBy: { createdAt: "asc" }, include: { actorUser: { select: { name: true, role: true } } } },
      documents: { where: { isDeleted: false }, orderBy: { createdAt: "asc" }, include: { uploadedBy: { select: { name: true } } } },
    },
  });
}

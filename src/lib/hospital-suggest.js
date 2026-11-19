import { prisma } from "./prisma";

const ACTIVE = ["FORWARDED", "ACCEPTED", "VISITED", "UNDER_TREATMENT"];

// Ranks hospitals for a referral: offers the department first, then in the
// employee's company city, then the lightest current load. The first one is
// what SUSALI suggests; the verifier can pick any other.
export async function suggestHospitals(referral) {
  const [hospitals, company, loads] = await Promise.all([
    prisma.hospital.findMany({ where: { isActive: true }, select: { id: true, name: true, city: true, departmentIds: true } }),
    prisma.company.findUnique({ where: { id: referral.companyId }, select: { city: true } }),
    prisma.referral.groupBy({ by: ["hospitalId"], where: { status: { in: ACTIVE }, hospitalId: { not: null } }, _count: { _all: true } }),
  ]);
  const load = Object.fromEntries(loads.map((l) => [l.hospitalId, l._count._all]));
  const city = (company?.city || "").trim().toLowerCase();
  const declined = (referral.declineReason || "").toLowerCase();
  const rows = hospitals.map((h) => ({
    id: h.id,
    name: h.name,
    city: h.city,
    offersDepartment: !referral.departmentId || h.departmentIds.includes(referral.departmentId),
    sameCity: Boolean(city) && h.city.trim().toLowerCase() === city,
    openReferrals: load[h.id] || 0,
    declinedBefore: Boolean(declined) && declined.startsWith(h.name.toLowerCase()),
  }));
  rows.sort((a, b) =>
    Number(a.declinedBefore) - Number(b.declinedBefore) ||
    Number(b.offersDepartment) - Number(a.offersDepartment) ||
    Number(b.sameCity) - Number(a.sameCity) ||
    a.openReferrals - b.openReferrals ||
    a.name.localeCompare(b.name)
  );
  return rows.map((r, i) => ({ ...r, suggested: i === 0 && r.offersDepartment && !r.declinedBefore }));
}

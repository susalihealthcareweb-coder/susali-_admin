import { prisma } from "./prisma";
import { issueMobileToken } from "./mobile-token";
import { loadPerson } from "./session";
import { ok } from "./api";

// What the app needs about the signed-in person, plus a fresh token.
export async function mobileSession(person) {
  const me = await loadPerson(person);
  const token = await issueMobileToken({ id: person.id, role: person.role });
  return ok({ token, me: await profileOf(me) });
}

export async function profileOf(me) {
  if (!me) return null;
  if (me.role === "PATIENT") {
    const e = me.employee;
    const family = await prisma.familyMember.count({ where: { employeeId: e.id, isActive: true } });
    return {
      role: "PATIENT",
      id: e.id,
      name: e.fullName,
      mobile: e.mobile,
      email: e.email,
      employeeCode: e.employeeCode,
      gender: e.gender,
      dateOfBirth: e.dateOfBirth,
      bloodGroup: e.bloodGroup,
      department: e.department,
      designation: e.designation,
      address: e.address,
      emergencyName: e.emergencyName,
      emergencyMobile: e.emergencyMobile,
      company: e.company ? { id: e.company.id, name: e.company.name } : null,
      approvalStatus: e.approvalStatus || "APPROVED",
      consentGiven: Boolean(e.consentAt),
      familyCount: family,
      deletionRequestedAt: e.deletionRequestedAt || null,
    };
  }
  const clusters = me.clusterIds?.length ? await prisma.cluster.findMany({ where: { id: { in: me.clusterIds } }, select: { id: true, name: true } }) : [];
  const u = await prisma.user.findUnique({ where: { id: me.id }, select: { deletionRequestedAt: true } });
  return { role: me.role, id: me.id, name: me.name, email: me.email, clusters, deletionRequestedAt: u?.deletionRequestedAt || null };
}

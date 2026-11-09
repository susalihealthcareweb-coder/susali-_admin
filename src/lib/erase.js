import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

// Anonymises a person who asked for deletion but has referral history that
// must be kept. Medical records stay, no longer linked to a name or contact.
export async function eraseEmployee(id) {
  const e = await prisma.employee.findUnique({ where: { id } });
  const year = new Date(e.dateOfBirth).getUTCFullYear();
  await prisma.employee.update({
    where: { id },
    data: {
      fullName: "Erased employee", mobile: `erased-${id}`, email: null, aadhaarLast4: null, address: null,
      emergencyName: null, emergencyMobile: null, department: null, designation: null, bloodGroup: null,
      dateOfBirth: new Date(Date.UTC(year, 0, 1)), isActive: false, consentAt: null,
    },
  });
  await prisma.familyMember.updateMany({ where: { employeeId: id }, data: { fullName: "Erased family member", mobile: null, isActive: false } });
  const refs = await prisma.referral.findMany({ where: { employeeId: id }, select: { id: true, patientSnapshot: true, patientRelation: true } });
  for (const r of refs) {
    const s = r.patientSnapshot || {};
    await prisma.referral.update({
      where: { id: r.id },
      data: {
        patientName: r.patientRelation && r.patientRelation !== "Self" ? "Erased family member" : "Erased employee",
        patientSnapshot: { name: "Erased employee", employeeCode: s.employeeCode, company: s.company, patient: { name: "Erased", relation: s.patient?.relation || r.patientRelation || "Self" } },
      },
    });
  }
  await prisma.notification.deleteMany({ where: { employeeId: id } });
  await prisma.otpRequest.deleteMany({ where: { mobile: e.mobile } });
}

export async function eraseUser(id) {
  await prisma.user.update({
    where: { id },
    data: {
      name: "Erased user", email: `erased-${id}@deleted.invalid`, mobile: `erased-${id}`,
      passwordHash: await bcrypt.hash(crypto.randomUUID(), 10), isActive: false, clusterIds: [], hospitalId: null,
    },
  });
  await prisma.notification.deleteMany({ where: { userId: id } });
}

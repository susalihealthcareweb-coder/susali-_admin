import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { getScopedCompany, isObjectId } from "@/lib/scope";
import { employeeSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { checkEmployeeUnique } from "@/lib/employees";
import { listReferrals } from "@/lib/referral-queries";

// Full employee record: profile, company, family and referrals.
export const GET = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "CLUSTER_MANAGER"]);
  if (!isObjectId(id)) throw new ApiError(404, "Employee not found.");
  const employee = await prisma.employee.findUnique({ where: { id }, include: { company: { select: { id: true, name: true, code: true, clusterId: true } } } });
  if (!employee) throw new ApiError(404, "Employee not found.");
  await getScopedCompany(me, employee.companyId);
  const [family, referrals] = await Promise.all([
    prisma.familyMember.findMany({ where: { employeeId: id, isActive: true }, orderBy: { createdAt: "asc" } }),
    listReferrals(me, { extra: { employeeId: id } }, { take: 50 }),
  ]);
  return ok({ employee, family, referrals: referrals.rows });
});

// Edit an employee or mark them Inactive when they leave.
export const PATCH = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "CLUSTER_MANAGER"]);
  if (!isObjectId(id)) throw new ApiError(404, "Employee not found.");
  const before = await prisma.employee.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Employee not found.");
  await getScopedCompany(me, before.companyId);
  const data = await body(req, employeeSchema.partial().extend({ isActive: z.boolean().optional() }));
  if (me.role === "SUDO_ADMIN" && "isActive" in data && data.isActive !== undefined && data.isActive !== before.isActive) {
    throw new ApiError(403, "Only the Super Admin can deactivate or reactivate.");
  }
  if (data.mobile || data.employeeCode) {
    const clash = await checkEmployeeUnique(before.companyId, { mobile: data.mobile || before.mobile, employeeCode: data.employeeCode || before.employeeCode }, id);
    if (clash) throw new ApiError(409, clash);
  }
  const employee = await prisma.employee.update({ where: { id }, data });
  await audit({ actor: me, action: data.isActive === false ? "DEACTIVATE" : "UPDATE", entity: "Employee", entityId: id, before, after: data, req });
  return ok({ employee });
});

// Super Admin only: permanent delete for an employee with no referrals.
export const DELETE = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN"]);
  if (!isObjectId(id)) throw new ApiError(404, "Employee not found.");
  const before = await prisma.employee.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Employee not found.");
  if (await prisma.referral.count({ where: { employeeId: id } })) throw new ApiError(409, "This employee has referrals on record. Deactivate them instead.");
  await prisma.familyMember.deleteMany({ where: { employeeId: id } });
  await prisma.notification.deleteMany({ where: { employeeId: id } });
  await prisma.employee.delete({ where: { id } });
  await audit({ actor: me, action: "DELETE", entity: "Employee", entityId: id, before, req });
  return ok({ ok: true });
});

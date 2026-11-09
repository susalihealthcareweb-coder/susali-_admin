import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { familySchema } from "@/lib/validators";
import { scopedEmployee } from "@/lib/family-staff";
import { isObjectId } from "@/lib/scope";
import { audit } from "@/lib/audit";
import { OPEN_STATUSES } from "@/lib/constants";

async function member(id, fid) {
  if (!isObjectId(fid)) throw new ApiError(404, "Family member not found.");
  const m = await prisma.familyMember.findFirst({ where: { id: fid, employeeId: id, isActive: true } });
  if (!m) throw new ApiError(404, "Family member not found.");
  return m;
}

export const PATCH = route(async (req, { id, fid }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "CLUSTER_MANAGER"]);
  await scopedEmployee(me, id);
  const before = await member(id, fid);
  const data = await body(req, familySchema.partial());
  const m = await prisma.familyMember.update({ where: { id: fid }, data });
  await audit({ actor: me, action: "UPDATE", entity: "FamilyMember", entityId: fid, before, after: data, req });
  return ok({ member: m });
});

// Removing hides the member (Sudo Admins cannot remove).
export const DELETE = route(async (req, { id, fid }) => {
  const me = await requireApi(["SUPER_ADMIN", "CLUSTER_MANAGER"]);
  await scopedEmployee(me, id);
  await member(id, fid);
  const open = await prisma.referral.count({ where: { familyMemberId: fid, status: { in: [...OPEN_STATUSES, "DRAFT"] } } });
  if (open) throw new ApiError(409, "This person has an open referral. Finish or cancel it first.");
  await prisma.familyMember.update({ where: { id: fid }, data: { isActive: false } });
  await audit({ actor: me, action: "DEACTIVATE", entity: "FamilyMember", entityId: fid, req });
  return ok({ ok: true });
});

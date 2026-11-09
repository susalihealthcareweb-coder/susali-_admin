import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { isObjectId } from "@/lib/scope";
import { staffUserSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { SAFE_USER, assertCanManage, syncClusterManagers, checkRoleFields } from "@/lib/users";

export const PATCH = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN"]);
  if (!isObjectId(id)) throw new ApiError(404, "User not found.");
  const before = await prisma.user.findUnique({ where: { id }, select: SAFE_USER });
  if (!before) throw new ApiError(404, "User not found.");
  assertCanManage(me, before.role);
  const data = await body(req, staffUserSchema.partial());
  if (me.role === "SUDO_ADMIN" && "isActive" in data && data.isActive !== undefined && data.isActive !== before.isActive) {
    throw new ApiError(403, "Only the Super Admin can deactivate or reactivate.");
  }
  if (data.role) assertCanManage(me, data.role);
  if (id === me.id && (data.isActive === false || (data.role && data.role !== me.role))) {
    throw new ApiError(400, "You cannot deactivate yourself or change your own role.");
  }
  const merged = { ...before, ...data };
  checkRoleFields(merged);
  const { password, ...rest } = data;
  const update = { ...rest, clusterIds: merged.clusterIds, hospitalId: merged.hospitalId };
  if (password) update.passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({ where: { id }, data: update, select: SAFE_USER });
  await syncClusterManagers(id, user.role === "CLUSTER_MANAGER" ? user.clusterIds : []);
  await audit({ actor: me, action: password ? "UPDATE_WITH_PASSWORD" : "UPDATE", entity: "User", entityId: id, before, after: rest, req });
  return ok({ user });
});

// Super Admin only: permanent delete for accounts with no recorded activity.
export const DELETE = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN"]);
  if (!isObjectId(id)) throw new ApiError(404, "User not found.");
  if (id === me.id) throw new ApiError(400, "You cannot delete yourself.");
  const before = await prisma.user.findUnique({ where: { id }, select: SAFE_USER });
  if (!before) throw new ApiError(404, "User not found.");
  const used = await Promise.all([
    prisma.company.count({ where: { createdById: id } }),
    prisma.companyVisit.count({ where: { userId: id } }),
    prisma.referral.count({ where: { OR: [{ verifiedById: id }, { lockedById: id }, { raisedById: id }] } }),
    prisma.referralStatusHistory.count({ where: { actorUserId: id } }),
    prisma.document.count({ where: { uploadedById: id } }),
  ]);
  if (used.some(Boolean)) throw new ApiError(409, "This user has activity on record. Deactivate them instead.");
  await syncClusterManagers(id, []);
  await prisma.notification.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });
  await audit({ actor: me, action: "DELETE", entity: "User", entityId: id, before, req });
  return ok({ ok: true });
});

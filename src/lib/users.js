import { prisma } from "./prisma";
import { ApiError } from "./api";

export const SAFE_USER = { id: true, name: true, email: true, mobile: true, role: true, isActive: true, clusterIds: true, hospitalId: true, muteWhatsapp: true, muteEmail: true, lastLoginAt: true, createdAt: true, deletionRequestedAt: true };

// Only Super Admin manages Super and Sudo Admins.
export function assertCanManage(me, role) {
  if (["SUPER_ADMIN", "SUDO_ADMIN"].includes(role) && me.role !== "SUPER_ADMIN") {
    throw new ApiError(403, "Only the Super Admin can manage admin accounts.");
  }
}

export async function syncClusterManagers(userId, clusterIds) {
  // Keep Cluster.managerIds in step with User.clusterIds.
  const clusters = await prisma.cluster.findMany({ where: { OR: [{ managerIds: { has: userId } }, { id: { in: clusterIds } }] } });
  for (const c of clusters) {
    const want = clusterIds.includes(c.id);
    const has = c.managerIds.includes(userId);
    if (want !== has) {
      await prisma.cluster.update({ where: { id: c.id }, data: { managerIds: { set: want ? [...c.managerIds, userId] : c.managerIds.filter((x) => x !== userId) } } });
    }
  }
}

export function checkRoleFields(data) {
  if (data.role === "CLUSTER_MANAGER" && !data.clusterIds?.length) throw new ApiError(400, "Assign at least one cluster.");
  if (data.role === "HOSPITAL_USER" && !data.hospitalId) throw new ApiError(400, "Choose the hospital.");
  if (data.role !== "CLUSTER_MANAGER") data.clusterIds = [];
  if (data.role !== "HOSPITAL_USER") data.hospitalId = null;
}


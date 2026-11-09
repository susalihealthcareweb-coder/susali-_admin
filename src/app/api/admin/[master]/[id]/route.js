import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { isObjectId } from "@/lib/scope";
import { masterSchemas, modelFor } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const PATCH = route(async (req, { master, id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN"]);
  const model = modelFor(master);
  if (!isObjectId(id)) throw new ApiError(404, "Not found.");
  const before = await prisma[model].findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Not found.");
  const data = await body(req, masterSchemas[master].partial());
  if (me.role === "SUDO_ADMIN" && "isActive" in data && data.isActive !== undefined && data.isActive !== before.isActive) {
    throw new ApiError(403, "Only the Super Admin can deactivate or reactivate.");
  }
  const row = await prisma[model].update({ where: { id }, data });
  await audit({ actor: me, action: data.isActive === false ? "DEACTIVATE" : "UPDATE", entity: model, entityId: id, before, after: data, req });
  return ok({ row });
});

// Super Admin only: permanent delete when nothing refers to the record.
const IN_USE = {
  cluster: async (id) => (await prisma.company.count({ where: { clusterId: id } })) + (await prisma.user.count({ where: { clusterIds: { has: id } } })),
  hospital: async (id) => (await prisma.referral.count({ where: { hospitalId: id } })) + (await prisma.user.count({ where: { hospitalId: id } })),
  dispensary: async (id) => (await prisma.company.count({ where: { dispensaryId: id } })) + (await prisma.referral.count({ where: { dispensaryId: id } })),
  superintendentHospital: async (id) => prisma.referral.count({ where: { superintendentHospitalId: id } }),
  department: async (id) => prisma.referral.count({ where: { departmentId: id } }),
};

export const DELETE = route(async (req, { master, id }) => {
  const me = await requireApi(["SUPER_ADMIN"]);
  const model = modelFor(master);
  if (!isObjectId(id)) throw new ApiError(404, "Not found.");
  const before = await prisma[model].findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Not found.");
  if (await IN_USE[model](id)) throw new ApiError(409, "This is already used by companies, users or referrals. Deactivate it instead.");
  if (model === "department") {
    const hs = await prisma.hospital.findMany({ where: { departmentIds: { has: id } } });
    for (const h of hs) await prisma.hospital.update({ where: { id: h.id }, data: { departmentIds: { set: h.departmentIds.filter((d) => d !== id) } } });
  }
  await prisma[model].delete({ where: { id } });
  await audit({ actor: me, action: "DELETE", entity: model, entityId: id, before, req });
  return ok({ ok: true });
});

import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { getScopedCompany } from "@/lib/scope";
import { companySchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { z } from "zod";

export const GET = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "CLUSTER_MANAGER"]);
  const company = await getScopedCompany(me, id, { cluster: true, dispensary: true, visits: { orderBy: { visitedAt: "desc" }, take: 20, include: { user: { select: { name: true } } } } });
  return ok({ company });
});

// Edit, deactivate, or (admins only) move to another cluster.
export const PATCH = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN"]);
  const before = await getScopedCompany(me, id);
  const input = await body(req, companySchema.partial().extend({ isActive: z.boolean().optional() }));
  if (input.clusterId && input.clusterId !== before.clusterId && me.role === "CLUSTER_MANAGER") {
    throw new ApiError(403, "Only admins can move a company to another cluster.");
  }
  if (me.role === "SUDO_ADMIN" && input.isActive !== undefined && input.isActive !== before.isActive) {
    throw new ApiError(403, "Only the Super Admin can deactivate or reactivate.");
  }
  if (me.role === "CLUSTER_MANAGER" && input.isActive === false) {
    throw new ApiError(403, "Only admins can deactivate a company.");
  }
  if (input.clusterId === null) delete input.clusterId;
  const company = await prisma.company.update({ where: { id }, data: input });
  // Moving a company carries its open referrals to the new cluster.
  if (input.clusterId && input.clusterId !== before.clusterId) {
    await prisma.referral.updateMany({ where: { companyId: id }, data: { clusterId: input.clusterId } });
  }
  await audit({ actor: me, action: "UPDATE", entity: "Company", entityId: id, before, after: input, req });
  return ok({ company });
});

// Super Admin only: permanent delete for a company with no employees or referrals.
export const DELETE = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN"]);
  const before = await getScopedCompany(me, id);
  const used = (await prisma.employee.count({ where: { companyId: id } })) + (await prisma.referral.count({ where: { companyId: id } }));
  if (used) throw new ApiError(409, "This company has employees or referrals. Deactivate it instead.");
  await prisma.companyVisit.deleteMany({ where: { companyId: id } });
  await prisma.company.delete({ where: { id } });
  await audit({ actor: me, action: "DELETE", entity: "Company", entityId: id, before, req });
  return ok({ ok: true });
});

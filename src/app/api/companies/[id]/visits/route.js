import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { getScopedCompany } from "@/lib/scope";
import { visitSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const GET = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "CLUSTER_MANAGER"]);
  await getScopedCompany(me, id);
  const visits = await prisma.companyVisit.findMany({ where: { companyId: id }, orderBy: { visitedAt: "desc" }, include: { user: { select: { name: true } } } });
  return ok({ visits });
});

export const POST = route(async (req, { id }) => {
  const me = await requireApi(["CLUSTER_MANAGER", "SUPER_ADMIN", "SUDO_ADMIN"]);
  await getScopedCompany(me, id);
  const data = await body(req, visitSchema);
  if (data.photoKey && !data.photoKey.startsWith(`companies/${id}/`)) throw new ApiError(400, "Photo does not belong to this company.");
  const visit = await prisma.companyVisit.create({ data: { ...data, companyId: id, userId: me.id } });
  await audit({ actor: me, action: "CREATE", entity: "CompanyVisit", entityId: visit.id, after: visit, req });
  return ok({ visit }, { status: 201 });
});

import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError, pageParams } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { companyScope } from "@/lib/scope";
import { companySchema, visitSchema } from "@/lib/validators";
import { nextCompanyCode } from "@/lib/counter";
import { audit } from "@/lib/audit";

export const GET = route(async (req) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "CLUSTER_MANAGER"]);
  const url = new URL(req.url);
  const { page, take, skip } = pageParams(url);
  const q = url.searchParams.get("q");
  const where = { AND: [companyScope(me), q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }] } : {}] };
  const [rows, total] = await Promise.all([
    prisma.company.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { cluster: { select: { name: true } }, _count: { select: { employees: true } } } }),
    prisma.company.count({ where }),
  ]);
  return ok({ rows, total, page, pages: Math.max(1, Math.ceil(total / take)) });
});

// Cluster Manager registers a company in their cluster, with the visit.
export const POST = route(async (req) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN"]);
  const input = await body(req, companySchema.extend({ visit: visitSchema.optional() }));
  const { visit, ...data } = input;
  if (!data.clusterId) throw new ApiError(400, "Choose a cluster.");
  const company = await prisma.company.create({ data: { ...data, code: await nextCompanyCode(), createdById: me.id } });
  if (visit) await prisma.companyVisit.create({ data: { ...visit, companyId: company.id, userId: me.id } });
  await audit({ actor: me, action: "CREATE", entity: "Company", entityId: company.id, after: company, req });
  return ok({ company }, { status: 201 });
});

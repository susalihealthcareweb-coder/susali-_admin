import { prisma } from "@/lib/prisma";
import { route, ok, pageParams } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { companyScope } from "@/lib/scope";

// Employee search across the companies this person may see.
export const GET = route(async (req) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "CLUSTER_MANAGER"]);
  const url = new URL(req.url);
  const { take, skip, page } = pageParams(url, 30);
  const q = (url.searchParams.get("q") || "").trim();
  const companies = await prisma.company.findMany({ where: companyScope(me), select: { id: true, name: true } });
  const cname = Object.fromEntries(companies.map((c) => [c.id, c.name]));
  const rx = { contains: q, mode: "insensitive" };
  const where = {
    companyId: { in: companies.map((c) => c.id) },
    ...(url.searchParams.get("active") === "1" ? { isActive: true } : {}),
    ...(q ? { OR: [{ fullName: rx }, { employeeCode: rx }, { mobile: { contains: q.replace(/\D/g, "") || q } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.employee.findMany({ where, orderBy: q ? { fullName: "asc" } : { updatedAt: "desc" }, take, skip, include: { _count: { select: { familyMembers: { where: { isActive: true } } } } } }),
    prisma.employee.count({ where }),
  ]);
  return ok({
    rows: rows.map(({ _count, ...e }) => ({ ...e, companyName: cname[e.companyId], familyCount: _count.familyMembers })),
    total,
    page,
  });
});

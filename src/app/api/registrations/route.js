import { prisma } from "@/lib/prisma";
import { route, ok } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { companyScope } from "@/lib/scope";

// Self-registrations for this person's companies (PENDING by default).
export const GET = route(async (req) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "CLUSTER_MANAGER"]);
  const status = new URL(req.url).searchParams.get("status") || "PENDING";
  const companies = await prisma.company.findMany({ where: companyScope(me), select: { id: true, name: true } });
  const cname = Object.fromEntries(companies.map((c) => [c.id, c.name]));
  const rows = await prisma.employee.findMany({
    where: { companyId: { in: companies.map((c) => c.id) }, selfRegistered: true, approvalStatus: status },
    orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
    take: 100,
  });
  return ok({ rows: rows.map((e) => ({ ...e, companyName: cname[e.companyId] })) });
});

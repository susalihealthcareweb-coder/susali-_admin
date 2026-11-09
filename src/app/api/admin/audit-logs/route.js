import { prisma } from "@/lib/prisma";
import { route, ok, pageParams } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { auditWhere } from "@/lib/audit-query";

export const GET = route(async (req) => {
  await requireApi(["SUPER_ADMIN", "SUDO_ADMIN"]);
  const url = new URL(req.url);
  const { take, skip, page } = pageParams(url, 50);
  const where = auditWhere(Object.fromEntries(url.searchParams));
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take, skip }),
    prisma.auditLog.count({ where }),
  ]);
  return ok({ rows, total, page });
});

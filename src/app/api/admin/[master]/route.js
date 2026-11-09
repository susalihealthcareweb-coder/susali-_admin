import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { masterSchemas, modelFor } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const GET = route(async (req, { master }) => {
  await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "CLUSTER_MANAGER", "PATIENT", "HOSPITAL_USER"]);
  const model = modelFor(master);
  const activeOnly = new URL(req.url).searchParams.get("active") === "1";
  const where = activeOnly && model !== "department" ? { isActive: true } : {};
  const rows = await prisma[model].findMany({ where, orderBy: { name: "asc" } });
  return ok({ rows });
});

export const POST = route(async (req, { master }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN"]);
  const model = modelFor(master);
  const data = await body(req, masterSchemas[master]);
  const row = await prisma[model].create({ data });
  await audit({ actor: me, action: "CREATE", entity: model, entityId: row.id, after: row, req });
  return ok({ row }, { status: 201 });
});

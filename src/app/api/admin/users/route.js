import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError, pageParams } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { staffUserSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { SAFE_USER, assertCanManage, syncClusterManagers, checkRoleFields } from "@/lib/users";

export const GET = route(async (req) => {
  await requireApi(["SUPER_ADMIN", "SUDO_ADMIN"]);
  const url = new URL(req.url);
  const { take, skip, page } = pageParams(url, 50);
  const role = url.searchParams.get("role");
  const where = role ? { role } : {};
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, select: SAFE_USER, orderBy: { createdAt: "desc" }, take, skip }),
    prisma.user.count({ where }),
  ]);
  return ok({ rows, total, page });
});

export const POST = route(async (req) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN"]);
  const data = await body(req, staffUserSchema);
  assertCanManage(me, data.role);
  checkRoleFields(data);
  if (!data.password) throw new ApiError(400, "Set an initial password (at least 8 characters).");
  if (me.role === "SUDO_ADMIN") data.isActive = true;
  const { password, ...rest } = data;
  const user = await prisma.user.create({ data: { ...rest, passwordHash: await bcrypt.hash(password, 10) }, select: SAFE_USER });
  if (user.role === "CLUSTER_MANAGER") await syncClusterManagers(user.id, user.clusterIds);
  await audit({ actor: me, action: "CREATE", entity: "User", entityId: user.id, after: user, req });
  return ok({ user }, { status: 201 });
});

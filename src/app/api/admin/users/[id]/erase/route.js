import { prisma } from "@/lib/prisma";
import { route, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { isObjectId } from "@/lib/scope";
import { eraseUser } from "@/lib/erase";
import { syncClusterManagers } from "@/lib/users";
import { audit } from "@/lib/audit";

// Super Admin: erase a staff user's personal data, keeping their activity history anonymous.
export const POST = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN"]);
  if (!isObjectId(id)) throw new ApiError(404, "User not found.");
  if (id === me.id) throw new ApiError(400, "You cannot erase yourself.");
  if (!(await prisma.user.findUnique({ where: { id }, select: { id: true } }))) throw new ApiError(404, "User not found.");
  await syncClusterManagers(id, []);
  await eraseUser(id);
  await audit({ actor: me, action: "ERASE_PERSONAL_DATA", entity: "User", entityId: id, req });
  return ok({ ok: true });
});

import { prisma } from "@/lib/prisma";
import { route, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { isObjectId } from "@/lib/scope";
import { eraseEmployee } from "@/lib/erase";
import { audit } from "@/lib/audit";

// Super Admin: erase an employee's personal data but keep anonymous referral history.
export const POST = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN"]);
  if (!isObjectId(id) || !(await prisma.employee.findUnique({ where: { id }, select: { id: true } }))) throw new ApiError(404, "Employee not found.");
  await eraseEmployee(id);
  await audit({ actor: me, action: "ERASE_PERSONAL_DATA", entity: "Employee", entityId: id, req });
  return ok({ ok: true });
});

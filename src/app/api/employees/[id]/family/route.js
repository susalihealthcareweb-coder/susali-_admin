import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { familySchema } from "@/lib/validators";
import { scopedEmployee } from "@/lib/family-staff";
import { audit } from "@/lib/audit";

// Family on an employee's card, managed by their Cluster Manager or an admin.
export const GET = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "CLUSTER_MANAGER"]);
  await scopedEmployee(me, id);
  const rows = await prisma.familyMember.findMany({ where: { employeeId: id, isActive: true }, orderBy: { createdAt: "asc" } });
  return ok({ rows });
});

export const POST = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "CLUSTER_MANAGER"]);
  await scopedEmployee(me, id);
  const data = await body(req, familySchema);
  if (data.relation === "Spouse" && (await prisma.familyMember.count({ where: { employeeId: id, isActive: true, relation: "Spouse" } }))) {
    throw new ApiError(409, "A spouse is already on this card.");
  }
  const member = await prisma.familyMember.create({ data: { ...data, employeeId: id } });
  await audit({ actor: me, action: "CREATE", entity: "FamilyMember", entityId: member.id, after: member, req });
  return ok({ member }, { status: 201 });
});

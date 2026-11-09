import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { familySchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

const MAX_FAMILY = 12;

export const GET = route(async () => {
  const me = await requireApi(["PATIENT"]);
  const rows = await prisma.familyMember.findMany({ where: { employeeId: me.id, isActive: true }, orderBy: { createdAt: "asc" } });
  return ok({ rows });
});

export const POST = route(async (req) => {
  const me = await requireApi(["PATIENT"]);
  const data = await body(req, familySchema);
  const count = await prisma.familyMember.count({ where: { employeeId: me.id, isActive: true } });
  if (count >= MAX_FAMILY) throw new ApiError(400, `You can add up to ${MAX_FAMILY} family members.`);
  if (data.relation === "Spouse" && (await prisma.familyMember.count({ where: { employeeId: me.id, isActive: true, relation: "Spouse" } }))) {
    throw new ApiError(409, "A spouse is already on your card.");
  }
  const member = await prisma.familyMember.create({ data: { ...data, employeeId: me.id } });
  await audit({ actor: me, action: "CREATE", entity: "FamilyMember", entityId: member.id, after: member, req });
  return ok({ member }, { status: 201 });
});

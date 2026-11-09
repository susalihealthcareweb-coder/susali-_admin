import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { isObjectId } from "@/lib/scope";
import { familySchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { OPEN_STATUSES } from "@/lib/constants";

async function own(me, id) {
  if (!isObjectId(id)) throw new ApiError(404, "Family member not found.");
  const m = await prisma.familyMember.findFirst({ where: { id, employeeId: me.id, isActive: true } });
  if (!m) throw new ApiError(404, "Family member not found.");
  return m;
}

export const PATCH = route(async (req, { id }) => {
  const me = await requireApi(["PATIENT"]);
  const before = await own(me, id);
  const data = await body(req, familySchema.partial());
  const member = await prisma.familyMember.update({ where: { id }, data });
  // Keep the name on draft referrals in step.
  if (data.fullName || data.relation) {
    await prisma.referral.updateMany({ where: { familyMemberId: id, status: { in: ["DRAFT", "INFO_REQUESTED"] } }, data: { patientName: member.fullName, patientRelation: member.relation } });
  }
  await audit({ actor: me, action: "UPDATE", entity: "FamilyMember", entityId: id, before, after: data, req });
  return ok({ member });
});

// Removing hides the member; past referrals keep their records.
export const DELETE = route(async (req, { id }) => {
  const me = await requireApi(["PATIENT"]);
  await own(me, id);
  const open = await prisma.referral.count({ where: { familyMemberId: id, status: { in: [...OPEN_STATUSES, "DRAFT"] } } });
  if (open) throw new ApiError(409, "This person has an open referral. Finish or cancel it first.");
  await prisma.familyMember.update({ where: { id }, data: { isActive: false } });
  await audit({ actor: me, action: "DEACTIVATE", entity: "FamilyMember", entityId: id, req });
  return ok({ ok: true });
});

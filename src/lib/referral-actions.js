import { prisma } from "./prisma";
import { ApiError } from "./api";
import { canTransition } from "./referral-flow";
import { audit } from "./audit";
import { STATUS } from "./constants";

// Moves a referral to a new status, guarded by the lifecycle map and by an
// optimistic check that nobody else changed it in the meantime.
export async function changeStatus({ referral, to, me, data = {}, remarks, req, force = false, action }) {
  const from = referral.status;
  if (!force && !canTransition(from, to)) {
    throw new ApiError(409, `Cannot move a referral from ${STATUS[from]?.label} to ${STATUS[to]?.label}.`);
  }
  const res = await prisma.referral.updateMany({
    where: { id: referral.id, status: from, updatedAt: referral.updatedAt },
    data: { status: to, ...data },
  });
  if (res.count !== 1) throw new ApiError(409, "This referral was just changed by someone else. Reload and try again.");
  await prisma.referralStatusHistory.create({
    data: {
      referralId: referral.id,
      fromStatus: from,
      toStatus: to,
      actorUserId: me.kind === "staff" ? me.id : null,
      actorIsPatient: me.kind === "patient",
      remarks: remarks || null,
    },
  });
  const updated = await prisma.referral.findUnique({
    where: { id: referral.id },
    include: { employee: true, hospital: true },
  });
  await audit({
    actor: me,
    action: action || "STATUS_CHANGE",
    entity: "Referral",
    entityId: referral.id,
    before: { status: from },
    after: { status: to, ...data, remarks },
    req,
  });
  return updated;
}

import { prisma } from "@/lib/prisma";
import { route, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { isObjectId } from "@/lib/scope";
import { kickQueue } from "@/lib/notify";
import { audit } from "@/lib/audit";

// Super Admin manually retries a failed WhatsApp or email.
export const POST = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN"]);
  if (!isObjectId(id)) throw new ApiError(404, "Not found.");
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.status !== "FAILED") throw new ApiError(409, "Only failed messages can be retried.");
  await prisma.notification.update({ where: { id }, data: { status: "QUEUED", attempts: 0, nextTryAt: new Date(), error: null } });
  await audit({ actor: me, action: "NOTIFICATION_RETRY", entity: "Notification", entityId: id, req });
  kickQueue();
  return ok({ ok: true });
});

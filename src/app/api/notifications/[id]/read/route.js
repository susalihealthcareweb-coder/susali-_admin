import { prisma } from "@/lib/prisma";
import { route, ok } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { isObjectId } from "@/lib/scope";

export const PATCH = route(async (req, { id }) => {
  const me = await requireApi();
  if (!isObjectId(id)) return ok({ ok: true });
  await prisma.notification.updateMany({
    where: { id, ...(me.kind === "patient" ? { employeeId: me.id } : { userId: me.id }) },
    data: { isRead: true },
  });
  return ok({ ok: true });
});

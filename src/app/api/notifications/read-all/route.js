import { prisma } from "@/lib/prisma";
import { route, ok } from "@/lib/api";
import { requireApi } from "@/lib/session";

export const PATCH = route(async () => {
  const me = await requireApi();
  await prisma.notification.updateMany({
    where: { channel: "IN_APP", isRead: false, ...(me.kind === "patient" ? { employeeId: me.id } : { userId: me.id }) },
    data: { isRead: true },
  });
  return ok({ ok: true });
});

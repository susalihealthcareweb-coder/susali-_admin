import { prisma } from "@/lib/prisma";
import { route, ok, pageParams } from "@/lib/api";
import { requireApi } from "@/lib/session";

// In-app feed for the signed-in person.
export const GET = route(async (req) => {
  const me = await requireApi();
  const { take, skip, page } = pageParams(new URL(req.url));
  const where = { channel: "IN_APP", ...(me.kind === "patient" ? { employeeId: me.id } : { userId: me.id }) };
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take, skip }),
    prisma.notification.count({ where: { ...where, isRead: false } }),
  ]);
  return ok({ rows, unread, page });
});

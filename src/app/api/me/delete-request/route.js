import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { route, body, ok } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { audit } from "@/lib/audit";
import { kickQueue } from "@/lib/notify";

// "Delete my account" from the app (required by the App Store and Play Store).
// Records the request and alerts Super Admins, who remove the account and its
// personal data. Referral records needed by law are anonymised, not kept identifiable.
export const POST = route(async (req) => {
  const me = await requireApi(["PATIENT", "CLUSTER_MANAGER"]);
  const { reason } = await body(req, z.object({ reason: z.string().trim().max(500).optional() }));
  const now = new Date();
  if (me.kind === "patient") await prisma.employee.update({ where: { id: me.id }, data: { deletionRequestedAt: now } });
  else await prisma.user.update({ where: { id: me.id }, data: { deletionRequestedAt: now } });
  await audit({ actor: me, action: "ACCOUNT_DELETION_REQUESTED", entity: me.kind === "patient" ? "Employee" : "User", entityId: me.id, after: { reason }, req });

  const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true } });
  const who = me.kind === "patient" ? `${me.name} (employee, ${me.employee.mobile})` : `${me.name} (Cluster Manager, ${me.email})`;
  const title = "Account deletion requested";
  const text = `${who} asked for their SUSALI account and personal data to be deleted${reason ? `: "${reason}"` : "."}`;
  const rows = admins.flatMap((a) => [
    { event: "ACCOUNT_DELETION", channel: "IN_APP", userId: a.id, recipient: a.id, title, body: text, status: "SENT" },
    ...(a.muteEmail ? [] : [{ event: "ACCOUNT_DELETION", channel: "EMAIL", userId: a.id, recipient: a.email, title, body: text, status: "QUEUED", payload: { link: `${(process.env.APP_URL || "").replace(/\/$/, "")}/super-admin` } }]),
  ]);
  if (rows.length) await prisma.notification.createMany({ data: rows });
  kickQueue();
  return ok({ ok: true, requestedAt: now });
});

import { prisma } from "@/lib/prisma";
import { route, ok } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { audit } from "@/lib/audit";

// DPDP Act consent, recorded once at first login.
export const POST = route(async (req) => {
  const me = await requireApi(["PATIENT"]);
  await prisma.employee.update({ where: { id: me.id }, data: { consentAt: new Date() } });
  await audit({ actor: me, action: "CONSENT_GIVEN", entity: "Employee", entityId: me.id, req });
  return ok({ ok: true });
});

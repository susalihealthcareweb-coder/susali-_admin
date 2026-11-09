import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { route, body, ok } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { audit } from "@/lib/audit";
import { v } from "@/lib/validators";

// Patients may change only email, address and emergency contact.
export const PATCH = route(async (req) => {
  const me = await requireApi(["PATIENT"]);
  const data = await body(req, z.object({ email: v.optEmail, address: v.optStr, emergencyName: v.optStr, emergencyMobile: v.optMobile }));
  const before = me.employee;
  const after = await prisma.employee.update({ where: { id: me.id }, data });
  await audit({ actor: me, action: "UPDATE", entity: "Employee", entityId: me.id, before: { email: before.email, address: before.address, emergencyName: before.emergencyName, emergencyMobile: before.emergencyMobile }, after: data, req });
  return ok({ employee: after });
});

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { getScopedCompany, isObjectId } from "@/lib/scope";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

// Cluster Manager (or admin) approves or rejects a self-registration.
export const POST = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "CLUSTER_MANAGER"]);
  if (!isObjectId(id)) throw new ApiError(404, "Employee not found.");
  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) throw new ApiError(404, "Employee not found.");
  const company = await getScopedCompany(me, emp.companyId);
  if (emp.approvalStatus !== "PENDING") throw new ApiError(409, "This registration has already been reviewed.");
  const { decision, note } = await body(req, z.object({
    decision: z.enum(["APPROVE", "REJECT"]),
    note: z.string().trim().max(500).optional(),
  }));
  if (decision === "REJECT" && !note) throw new ApiError(400, "Add a reason for rejecting.");
  const approved = decision === "APPROVE";
  const updated = await prisma.employee.update({
    where: { id },
    data: {
      approvalStatus: approved ? "APPROVED" : "REJECTED",
      isActive: approved,
      approvalNote: note || null,
      approvedById: me.id,
      approvedAt: new Date(),
    },
  });
  await audit({ actor: me, action: approved ? "REGISTRATION_APPROVED" : "REGISTRATION_REJECTED", entity: "Employee", entityId: id, after: { note }, req });
  await notify(approved ? "EMPLOYEE_APPROVED" : "EMPLOYEE_REJECTED", { employee: { ...updated, company } });
  return ok({ employee: updated });
});

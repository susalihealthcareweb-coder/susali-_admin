import { route, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { roleFromSlug } from "@/lib/constants";
import { adminDashboard, supportDashboard, clusterDashboard, hospitalDashboard, chartData } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { pendingRegistrations } from "@/lib/employees";

// Dashboard counts for the signed-in person's own role.
export const GET = route(async (req, { role }) => {
  const me = await requireApi();
  const r = roleFromSlug(role);
  if (r !== me.role) throw new ApiError(403, "You can load only your own dashboard.");
  switch (me.role) {
    case "SUPER_ADMIN":
      return ok({ ...(await adminDashboard()), charts: await chartData() });
    case "SUDO_ADMIN":
      return ok({ ...(await adminDashboard()), support: await supportDashboard(me) });
    case "SUPPORT":
      return ok(await supportDashboard(me));
    case "CLUSTER_MANAGER":
      return ok({ ...(await clusterDashboard(me)), pendingApprovals: await pendingRegistrations(me) });
    case "HOSPITAL_USER":
      return ok(await hospitalDashboard(me));
    case "PATIENT": {
      const active = await prisma.referral.findFirst({ where: { employeeId: me.id, status: { notIn: ["CLOSED", "CANCELLED", "REJECTED"] } }, orderBy: { updatedAt: "desc" } });
      return ok({ active });
    }
  }
});

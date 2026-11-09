import { prisma } from "./prisma";
import { ApiError } from "./api";

// Who may fill in a referral on the patient's side: the employee, or the
// Cluster Manager who raised it for them.
export function isRaiser(me, r) {
  return me.role === "CLUSTER_MANAGER" && r.raisedById === me.id;
}

export async function patientSideEmployee(me, r) {
  if (me.role === "PATIENT" && r.employeeId === me.id) return me.employee;
  if (isRaiser(me, r)) {
    return prisma.employee.findUnique({ where: { id: r.employeeId }, include: { company: { select: { id: true, name: true, clusterId: true, isActive: true } } } });
  }
  throw new ApiError(403, "Only the employee or the Cluster Manager who raised this referral can change it.");
}

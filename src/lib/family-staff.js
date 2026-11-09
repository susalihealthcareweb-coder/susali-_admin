import { prisma } from "./prisma";
import { ApiError } from "./api";
import { getScopedCompany, isObjectId } from "./scope";

// Loads an employee the signed-in staff member may manage.
export async function scopedEmployee(me, id) {
  if (!isObjectId(id)) throw new ApiError(404, "Employee not found.");
  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) throw new ApiError(404, "Employee not found.");
  await getScopedCompany(me, emp.companyId);
  return emp;
}

import { prisma } from "./prisma";

export const EMPLOYEE_COLUMNS = [
  ["employeeCode", "Employee ID"],
  ["fullName", "Full Name"],
  ["gender", "Gender (Male/Female/Other)"],
  ["dateOfBirth", "Date of Birth (YYYY-MM-DD)"],
  ["mobile", "Mobile"],
  ["email", "Email"],
  ["aadhaarLast4", "Aadhaar Last 4"],
  ["department", "Department"],
  ["designation", "Designation"],
  ["bloodGroup", "Blood Group"],
  ["address", "Address"],
  ["emergencyName", "Emergency Contact Name"],
  ["emergencyMobile", "Emergency Contact Mobile"],
];

// Mobile is unique across employees; employee ID is unique within a company.
export async function checkEmployeeUnique(companyId, data, exceptId) {
  const not = exceptId ? { id: { not: exceptId } } : {};
  const [byMobile, byCode] = await Promise.all([
    prisma.employee.findFirst({ where: { mobile: data.mobile, ...not } }),
    prisma.employee.findFirst({ where: { companyId, employeeCode: data.employeeCode, ...not } }),
  ]);
  if (byMobile) return `Mobile ${data.mobile} is already registered${byMobile.isActive ? "" : " (inactive employee)"}.`;
  if (byCode) return `Employee ID ${data.employeeCode} already exists in this company.`;
  return null;
}

// Count of self-registrations waiting for this person to approve.
export async function pendingRegistrations(me) {
  const where = { approvalStatus: "PENDING" };
  if (me.role === "CLUSTER_MANAGER") {
    const companies = await prisma.company.findMany({ where: { clusterId: { in: me.clusterIds } }, select: { id: true } });
    where.companyId = { in: companies.map((c) => c.id) };
  }
  return prisma.employee.count({ where });
}

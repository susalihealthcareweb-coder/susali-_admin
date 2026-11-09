import { z } from "zod";
import { prisma } from "./prisma";
import { ApiError } from "./api";
import { employeeSchema, v } from "./validators";
import { verifyOtpFor, OTP_MESSAGES } from "./otp";
import { checkEmployeeUnique } from "./employees";
import { notify } from "./notify";
import { audit } from "./audit";

export const registerSchema = employeeSchema.extend({
  companyId: v.objectId,
  otp: z.string().trim(),
  consent: z.literal(true, { message: "Please accept the data-use consent" }),
});

// Self-registration shared by the website and the mobile app: verify the OTP,
// create the employee as PENDING approval and alert the Cluster Manager.
export async function registerEmployee(input, req) {
  const { companyId, otp, consent, ...data } = input;
  void consent;
  const company = await prisma.company.findFirst({ where: { id: companyId, isActive: true } });
  if (!company) throw new ApiError(400, "Choose your company from the list.");
  const clash = await checkEmployeeUnique(companyId, data);
  if (clash) throw new ApiError(409, clash.startsWith("Mobile") ? OTP_MESSAGES.already_registered : clash);
  const res = await verifyOtpFor(data.mobile, otp, "REGISTER");
  if (res !== "ok") throw new ApiError(400, OTP_MESSAGES[res] || "OTP check failed.");
  const employee = await prisma.employee.create({
    data: { ...data, companyId, approvalStatus: "PENDING", selfRegistered: true, consentAt: new Date() },
  });
  await audit({ actorId: employee.id, actorRole: "PATIENT", action: "SELF_REGISTER", entity: "Employee", entityId: employee.id, after: { ...data, companyId }, req });
  await notify("EMPLOYEE_REGISTERED", { employee: { ...employee, company }, extra: { path: `/employees/${employee.id}` } });
  return employee;
}

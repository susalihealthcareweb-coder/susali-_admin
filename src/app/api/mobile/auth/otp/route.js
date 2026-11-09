import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { route, body, ApiError } from "@/lib/api";
import { v } from "@/lib/validators";
import { verifyOtpFor, OTP_MESSAGES } from "@/lib/otp";
import { audit } from "@/lib/audit";
import { mobileSession } from "@/lib/mobile-auth";

// Mobile app: verify the login OTP (sent by /api/auth/otp/send) and return a token.
export const POST = route(async (req) => {
  const { mobile, otp } = await body(req, z.object({ mobile: v.mobile, otp: z.string().trim() }));
  const emp = await prisma.employee.findUnique({ where: { mobile } });
  if (emp?.approvalStatus === "REJECTED") throw new ApiError(403, OTP_MESSAGES.rejected);
  if (!emp || !emp.isActive) throw new ApiError(404, OTP_MESSAGES.not_employee);
  const res = await verifyOtpFor(mobile, otp, "LOGIN");
  if (res !== "ok") throw new ApiError(401, OTP_MESSAGES[res] || OTP_MESSAGES.invalid_otp);
  await prisma.employee.update({ where: { id: emp.id }, data: { lastLoginAt: new Date() } });
  await audit({ actorId: emp.id, actorRole: "PATIENT", action: "LOGIN", entity: "Employee", entityId: emp.id, after: { client: "mobile" }, req });
  return mobileSession({ id: emp.id, role: "PATIENT" });
});

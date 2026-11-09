import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError } from "@/lib/api";
import { v } from "@/lib/validators";
import { sendOtpTo, OTP_MESSAGES } from "@/lib/otp";

// Step 1 of patient login: only active employees can receive an OTP.
export const POST = route(async (req) => {
  const { mobile } = await body(req, z.object({ mobile: v.mobile }));
  const emp = await prisma.employee.findUnique({ where: { mobile }, include: { company: { select: { isActive: true } } } });
  if (emp?.approvalStatus === "REJECTED") throw new ApiError(403, OTP_MESSAGES.rejected);
  if (!emp || !emp.isActive || !emp.company?.isActive) throw new ApiError(404, OTP_MESSAGES.not_employee);
  const result = await sendOtpTo(mobile, "LOGIN");
  if (result !== "ok") throw new ApiError(429, OTP_MESSAGES[result]);
  return ok({ sent: true, resendAfter: 30, dev: !process.env.MSG91_AUTH_KEY && process.env.NODE_ENV !== "production" });
});

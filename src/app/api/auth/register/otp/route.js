import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError } from "@/lib/api";
import { v } from "@/lib/validators";
import { sendOtpTo, OTP_MESSAGES } from "@/lib/otp";

// Step 1 of self-registration: confirm the mobile belongs to the person.
export const POST = route(async (req) => {
  const { mobile } = await body(req, z.object({ mobile: v.mobile }));
  const existing = await prisma.employee.findUnique({ where: { mobile } });
  if (existing) throw new ApiError(409, existing.approvalStatus === "REJECTED" ? OTP_MESSAGES.rejected : OTP_MESSAGES.already_registered);
  const result = await sendOtpTo(mobile, "REGISTER");
  if (result !== "ok") throw new ApiError(429, OTP_MESSAGES[result]);
  return ok({ sent: true, resendAfter: 30, dev: !process.env.MSG91_AUTH_KEY && process.env.NODE_ENV !== "production" });
});

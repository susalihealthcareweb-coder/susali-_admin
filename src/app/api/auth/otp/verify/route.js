import { z } from "zod";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { route, body, ok, ApiError } from "@/lib/api";
import { v } from "@/lib/validators";
import { OTP_MESSAGES } from "@/lib/otp";

// Step 2 of patient login: verifies the OTP and starts the session cookie.
export const POST = route(async (req) => {
  const { mobile, otp } = await body(req, z.object({ mobile: v.mobile, otp: z.string().trim() }));
  try {
    await signIn("patient", { mobile, otp, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) {
      throw new ApiError(401, OTP_MESSAGES[e.code] || OTP_MESSAGES.invalid_otp);
    }
    throw e;
  }
  return ok({ ok: true, redirect: "/patient" });
});

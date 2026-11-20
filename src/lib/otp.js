import crypto from "node:crypto";
import { prisma } from "./prisma";
import { msg91SendOtp, msg91VerifyOtp } from "./msg91";

const VALID_MS = 5 * 60 * 1000;
const RESEND_MS = 30 * 1000;
const MAX_ATTEMPTS = 3;
const MAX_SENDS_PER_15_MIN = 5;

// App Store / Play Store reviewers cannot receive SMS. One demo number set in
// REVIEW_LOGIN_MOBILE logs in with the fixed REVIEW_LOGIN_OTP; no SMS is sent.
export const isReviewLogin = (mobile) => Boolean(process.env.REVIEW_LOGIN_MOBILE && process.env.REVIEW_LOGIN_OTP && mobile === process.env.REVIEW_LOGIN_MOBILE);

// Until SMS sending is approved (DLT registration), FIXED_OTP=123456 makes every
// OTP (login, registration, hospital visit) that fixed code and sends no SMS.
// Anyone who knows a registered mobile number can then log in: remove FIXED_OTP
// as soon as SMS works.
export const fixedOtp = () => (/^\d{6}$/.test(process.env.FIXED_OTP || "") ? process.env.FIXED_OTP : null);
if (fixedOtp()) console.warn("[otp] FIXED_OTP is set: every OTP is the fixed code and no SMS is sent.");

// True when no real SMS goes out, so screens can explain which code to use.
export const otpIsTemporary = () => Boolean(fixedOtp()) || (!process.env.MSG91_AUTH_KEY && process.env.NODE_ENV !== "production");

// Returns "ok" or an error code. OTP values are never stored; MSG91 verifies them.
export async function sendOtpTo(mobile, purpose = "LOGIN") {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const recent = await prisma.otpRequest.findMany({
    where: { mobile, purpose, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });
  if (recent.length >= MAX_SENDS_PER_15_MIN) return "rate_limited";
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RESEND_MS) return "wait";
  if (!isReviewLogin(mobile) && !fixedOtp()) await msg91SendOtp(mobile);
  await prisma.otpRequest.create({
    data: { mobile, purpose, expiresAt: new Date(Date.now() + VALID_MS) },
  });
  return "ok";
}

export async function verifyOtpFor(mobile, otp, purpose = "LOGIN") {
  if (!/^\d{6}$/.test(otp)) return "invalid_otp";
  const req = await prisma.otpRequest.findFirst({
    where: { mobile, purpose, verified: false },
    orderBy: { createdAt: "desc" },
  });
  if (!req || req.expiresAt < new Date()) return "expired";
  if (req.attempts >= MAX_ATTEMPTS) return "too_many_attempts";
  const good = isReviewLogin(mobile)
    ? otp === process.env.REVIEW_LOGIN_OTP
    : fixedOtp() ? otp === fixedOtp() : await msg91VerifyOtp(mobile, otp);
  // One write records the attempt and, when correct, marks the code used.
  await prisma.otpRequest.update({ where: { id: req.id }, data: { attempts: { increment: 1 }, ...(good ? { verified: true } : {}) } });
  if (!good) return req.attempts + 1 >= MAX_ATTEMPTS ? "too_many_attempts" : "invalid_otp";
  return "ok";
}

export const OTP_MESSAGES = {
  not_employee: "This number is not registered yet. Register first, or contact your Cluster Manager.",
  rejected: "Your registration was not approved. Please contact your HR or Cluster Manager.",
  already_registered: "This mobile number is already registered. Please log in.",
  rate_limited: "Too many attempts. Try again in 15 minutes.",
  wait: "Please wait 30 seconds before requesting another OTP.",
  invalid_otp: "Incorrect OTP. Please try again.",
  expired: "OTP expired. Request a new one.",
  too_many_attempts: "Too many wrong attempts. Request a new OTP.",
};

const sig = (id, exp) => crypto.createHmac("sha256", process.env.AUTH_SECRET || "dev").update(`login|${id}|${exp}`).digest("hex");

// Two-minute token that lets a just-registered patient sign in without a second OTP.
export function makeLoginToken(employeeId) {
  const exp = Date.now() + 2 * 60 * 1000;
  return `${exp}.${sig(employeeId, exp)}`;
}
export function verifyLoginToken(token, employeeId) {
  const [exp, mac] = token.split(".");
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  const want = sig(employeeId, exp);
  return mac.length === want.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want));
}

import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { authConfig } from "./auth.config";
import { prisma } from "./prisma";
import { audit } from "./audit";
import { verifyOtpFor, verifyLoginToken } from "./otp";
import { normalizeMobile } from "./format";

class LoginError extends CredentialsSignin {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

async function tooManyFailures(key) {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const n = await prisma.auditLog.count({
    where: { action: "LOGIN_FAILED", entityId: key, createdAt: { gte: since } },
  });
  return n >= 5;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "staff",
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email || "").trim().toLowerCase();
        const password = String(creds?.password || "");
        if (!email || !password) throw new LoginError("missing");
        if (await tooManyFailures(email)) throw new LoginError("rate_limited");
        const user = await prisma.user.findUnique({ where: { email } });
        const valid = user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
        const h = await headers();
        if (!valid) {
          await audit({ actorRole: "ANONYMOUS", action: "LOGIN_FAILED", entity: "User", entityId: email, h });
          throw new LoginError(user && !user.isActive ? "inactive" : "invalid");
        }
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        await audit({ actorId: user.id, actorRole: user.role, action: "LOGIN", entity: "User", entityId: user.id, h });
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
    Credentials({
      id: "patient",
      credentials: { mobile: {}, otp: {}, token: {} },
      async authorize(creds) {
        const mobile = normalizeMobile(creds?.mobile);
        const otp = String(creds?.otp || "").trim();
        const employee = await prisma.employee.findUnique({ where: { mobile } });
        if (employee?.approvalStatus === "REJECTED") throw new LoginError("rejected");
        if (!employee || !employee.isActive) throw new LoginError("not_employee");
        // Right after self-registration the OTP is already verified, so a
        // short-lived signed token stands in for it.
        if (creds?.token) {
          if (!verifyLoginToken(String(creds.token), employee.id)) throw new LoginError("expired");
        } else {
          const result = await verifyOtpFor(mobile, otp, "LOGIN");
          if (result !== "ok") throw new LoginError(result);
        }
        await prisma.employee.update({ where: { id: employee.id }, data: { lastLoginAt: new Date() } });
        const h = await headers();
        await audit({ actorId: employee.id, actorRole: "PATIENT", action: "LOGIN", entity: "Employee", entityId: employee.id, h });
        return { id: employee.id, name: employee.fullName, role: "PATIENT" };
      },
    }),
  ],
});

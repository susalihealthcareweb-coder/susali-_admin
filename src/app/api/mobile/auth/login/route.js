import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { route, body, ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { mobileSession } from "@/lib/mobile-auth";

// Mobile app: email + password for Cluster Managers. Other staff use the website.
export const POST = route(async (req) => {
  const { email, password } = await body(req, z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }));
  const since = new Date(Date.now() - 15 * 60 * 1000);
  if ((await prisma.auditLog.count({ where: { action: "LOGIN_FAILED", entityId: email, createdAt: { gte: since } } })) >= 5) {
    throw new ApiError(429, "Too many failed attempts. Try again in 15 minutes.");
  }
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) {
    await audit({ actorRole: "ANONYMOUS", action: "LOGIN_FAILED", entity: "User", entityId: email, after: { client: "mobile" }, req });
    throw new ApiError(401, user && !user.isActive ? "This account is inactive." : "Email or password is incorrect.");
  }
  if (user.role !== "CLUSTER_MANAGER") {
    throw new ApiError(403, "The mobile app is for employees and Cluster Managers. Please use the SUSALI website.");
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ actorId: user.id, actorRole: user.role, action: "LOGIN", entity: "User", entityId: user.id, after: { client: "mobile" }, req });
  return mobileSession({ id: user.id, role: user.role });
});

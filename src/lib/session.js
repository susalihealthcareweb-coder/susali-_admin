import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "./auth";
import { readMobileToken } from "./mobile-token";
import { prisma } from "./prisma";
import { ApiError } from "./api";
import { homeFor } from "./constants";

// Reads the session and reloads the person from the database, so deactivation
// and cluster or hospital changes take effect at once.
// The mobile app sends `Authorization: Bearer <token>` instead of a cookie.
export async function getCurrentUser() {
  const bearer = (await headers()).get("authorization");
  const s = bearer ? await readMobileToken(bearer) : (await auth())?.user;
  if (!s?.id || !s.role) return null;
  return loadPerson(s);
}

export async function loadPerson(s) {
  if (s.role === "PATIENT") {
    const employee = await prisma.employee.findUnique({
      where: { id: s.id },
      include: { company: { select: { id: true, name: true, clusterId: true, isActive: true } } },
    });
    if (!employee || !employee.isActive) return null;
    return { kind: "patient", role: "PATIENT", id: employee.id, name: employee.fullName, employee };
  }
  const user = await prisma.user.findUnique({ where: { id: s.id } });
  if (!user || !user.isActive) return null;
  return {
    kind: "staff",
    role: user.role,
    id: user.id,
    name: user.name,
    email: user.email,
    clusterIds: user.clusterIds || [],
    hospitalId: user.hospitalId,
  };
}

// For pages: send to the right login, or home if the role does not fit.
export async function requirePage(roles) {
  const me = await getCurrentUser();
  if (!me) redirect(roles?.length === 1 && roles[0] === "PATIENT" ? "/login?mode=otp" : "/login?mode=email");
  if (roles && !roles.includes(me.role)) redirect(homeFor(me.role));
  return me;
}

// For API routes: 401 without a session, 403 for the wrong role.
export async function requireApi(roles) {
  const me = await getCurrentUser();
  if (!me) throw new ApiError(401, "Please log in.");
  if (roles && !roles.includes(me.role)) throw new ApiError(403, "You do not have access to this action.");
  return me;
}

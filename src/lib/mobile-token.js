import { SignJWT, jwtVerify } from "jose";

// Bearer tokens for the SUSALI mobile app (cookies are unreliable in native
// apps). Signed with a key derived from AUTH_SECRET; valid for 30 days.
const key = () => new TextEncoder().encode(`${process.env.AUTH_SECRET || "dev"}|susali-mobile`);
const ISSUER = "susali";
const AUDIENCE = "susali-mobile";

export async function issueMobileToken({ id, role }) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key());
}

export async function readMobileToken(authHeader) {
  const m = /^Bearer\s+(.+)$/i.exec(authHeader || "");
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], key(), { issuer: ISSUER, audience: AUDIENCE });
    return payload.sub && payload.role ? { id: payload.sub, role: payload.role } : null;
  } catch {
    return null;
  }
}

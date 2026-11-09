import { prisma } from "./prisma";

function clean(v) {
  if (v == null) return undefined;
  const o = JSON.parse(JSON.stringify(v));
  delete o.passwordHash;
  return o;
}

// Writes one audit row. `h` is a Headers object (from next/headers or a Request).
export async function audit({ actor, actorId, actorRole, action, entity, entityId, before, after, h, req }) {
  const hdrs = h || req?.headers;
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? actor?.id ?? null,
        actorRole: actorRole ?? actor?.role ?? "SYSTEM",
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        before: clean(before),
        after: clean(after),
        ipAddress: hdrs?.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        userAgent: hdrs?.get("user-agent")?.slice(0, 300) || null,
      },
    });
  } catch (e) {
    console.error("audit failed", e);
  }
}

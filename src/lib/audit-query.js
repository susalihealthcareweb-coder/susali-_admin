export function auditWhere({ q, action, entity, from, to }) {
  const and = [];
  if (action) and.push({ action });
  if (entity) and.push({ entity: { equals: entity, mode: "insensitive" } });
  if (from) and.push({ createdAt: { gte: new Date(from) } });
  if (to) and.push({ createdAt: { lte: new Date(new Date(to).getTime() + 86400000 - 1) } });
  if (q) and.push({ OR: [{ entityId: { contains: q } }, { actorId: { contains: q } }, { action: { contains: q.toUpperCase() } }, { ipAddress: { contains: q } }] });
  return and.length ? { AND: and } : {};
}

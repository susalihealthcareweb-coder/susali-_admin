import { prisma } from "@/lib/prisma";
import { route, ok } from "@/lib/api";

// Company search for the self-registration form: names and cities only.
export const GET = route(async (req) => {
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return ok({ rows: [] });
  const rx = { contains: q, mode: "insensitive" };
  const rows = await prisma.company.findMany({
    where: { isActive: true, OR: [{ name: rx }, { code: { equals: q.toUpperCase() } }] },
    select: { id: true, name: true, city: true },
    orderBy: { name: "asc" },
    take: 10,
  });
  return ok({ rows });
});

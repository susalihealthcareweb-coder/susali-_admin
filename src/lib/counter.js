import { prisma } from "./prisma";

async function next(key) {
  for (let i = 0; i < 3; i++) {
    try {
      const c = await prisma.counter.upsert({
        where: { id: key },
        create: { id: key, seq: 1 },
        update: { seq: { increment: 1 } },
      });
      return c.seq;
    } catch (e) {
      // Two first-time upserts can race on create; retry.
      if (i === 2) throw e;
    }
  }
}

export async function nextReferralNo() {
  const year = new Date().getUTCFullYear();
  const n = await next(`referral-${year}`);
  return `SUS-REF-${year}-${String(n).padStart(6, "0")}`;
}

export async function nextCompanyCode() {
  const n = await next("company");
  return `SUS-CMP-${String(n).padStart(4, "0")}`;
}

export async function nextDraftNo() {
  const n = await next("draft");
  return `DRAFT-${String(n).padStart(7, "0")}`;
}

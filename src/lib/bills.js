import { prisma } from "./prisma";

// Keeps Referral.billTotal equal to the sum of its (not deleted) bill documents.
export async function refreshBillTotal(referralId) {
  const bills = await prisma.document.findMany({ where: { referralId, category: "BILL", isDeleted: false }, select: { amount: true } });
  const total = bills.length ? bills.reduce((s, b) => s + (b.amount || 0), 0) : null;
  await prisma.referral.update({ where: { id: referralId }, data: { billTotal: total } });
  return total;
}

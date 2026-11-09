import { prisma } from "./prisma";
import { ApiError } from "./api";
import { HOSPITAL_VISIBLE } from "./constants";

// The referrals a person may see (section 2, "Scope of data each role sees").
export function referralScope(me) {
  switch (me.role) {
    case "SUPER_ADMIN":
    case "SUDO_ADMIN":
    case "SUPPORT":
      return { status: { not: "DRAFT" } };
    case "CLUSTER_MANAGER":
      // Drafts stay private, except ones this Cluster Manager raised.
      return { clusterId: { in: me.clusterIds }, OR: [{ status: { not: "DRAFT" } }, { raisedById: me.id }] };
    case "HOSPITAL_USER":
      return { hospitalId: me.hospitalId || "000000000000000000000000", status: { in: HOSPITAL_VISIBLE } };
    case "PATIENT":
      return { employeeId: me.id };
    default:
      return { id: "000000000000000000000000" };
  }
}

export function companyScope(me) {
  if (me.role === "CLUSTER_MANAGER") return { clusterId: { in: me.clusterIds } };
  if (["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT"].includes(me.role)) return {};
  return { id: "000000000000000000000000" };
}

export const isObjectId = (id) => /^[a-f0-9]{24}$/i.test(String(id || ""));

export async function getScopedReferral(me, id, include) {
  if (!isObjectId(id)) throw new ApiError(404, "Referral not found.");
  const r = await prisma.referral.findFirst({ where: { AND: [{ id }, referralScope(me)] }, include });
  if (!r) throw new ApiError(404, "Referral not found.");
  return r;
}

export async function getScopedCompany(me, id, include) {
  if (!isObjectId(id)) throw new ApiError(404, "Company not found.");
  const c = await prisma.company.findFirst({ where: { AND: [{ id }, companyScope(me)] }, include });
  if (!c) throw new ApiError(404, "Company not found.");
  return c;
}

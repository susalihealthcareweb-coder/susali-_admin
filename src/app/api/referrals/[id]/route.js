import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { getScopedReferral } from "@/lib/scope";
import { referralDetail } from "@/lib/referral-queries";
import { referralDraftSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { beneficiaryFields } from "@/lib/family";
import { patientSideEmployee, isRaiser } from "@/lib/referral-owner";
import { PATIENT_DOC_CATEGORIES } from "@/lib/constants";
import { VERIFIER_ROLES } from "@/lib/constants";

export const GET = route(async (req, { id }) => {
  const me = await requireApi();
  await getScopedReferral(me, id);
  const r = await referralDetail(id);
  // Cluster Managers see status, not medical documents.
  // Cluster Managers never see hospital documents; the one who raised the
  // referral sees the letters they uploaded.
  if (me.role === "CLUSTER_MANAGER") r.documents = isRaiser(me, r) ? r.documents.filter((d) => PATIENT_DOC_CATEGORIES.includes(d.category)) : [];
  let duplicates = [];
  if (VERIFIER_ROLES.includes(me.role)) {
    duplicates = await prisma.referral.findMany({
      where: {
        id: { not: r.id },
        employeeId: r.employeeId,
        hospitalId: r.hospitalId || undefined,
        status: { notIn: ["DRAFT", "REJECTED", "CANCELLED", "CLOSED"] },
      },
      select: { id: true, referralNo: true, status: true, familyMemberId: true },
    });
    duplicates = duplicates.filter((d) => (d.familyMemberId || null) === (r.familyMemberId || null));
  }
  return ok({ referral: r, duplicates });
});

// Patient edits a Draft, or a referral returned with Information Requested.
export const PATCH = route(async (req, { id }) => {
  const me = await requireApi(["PATIENT", "CLUSTER_MANAGER"]);
  const r = await getScopedReferral(me, id);
  const emp = await patientSideEmployee(me, r);
  if (!["DRAFT", "INFO_REQUESTED"].includes(r.status)) {
    throw new ApiError(409, "A submitted referral can be edited only when more information is requested.");
  }
  const data = await body(req, referralDraftSchema);
  const who = await beneficiaryFields(emp, data.familyMemberId);
  const updated = await prisma.referral.update({ where: { id }, data: { ...data, ...who } });
  await audit({ actor: me, action: "UPDATE", entity: "Referral", entityId: id, after: data, req });
  return ok({ referral: updated });
});

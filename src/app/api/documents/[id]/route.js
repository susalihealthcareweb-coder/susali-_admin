import { prisma } from "@/lib/prisma";
import { route, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { getScopedReferral, isObjectId } from "@/lib/scope";
import { audit } from "@/lib/audit";
import { PATIENT_DOC_CATEGORIES, HOSPITAL_DOC_CATEGORIES } from "@/lib/constants";

// The uploader can remove a wrong file before the case is completed.
export const DELETE = route(async (req, { id }) => {
  const me = await requireApi(["PATIENT", "HOSPITAL_USER", "CLUSTER_MANAGER"]);
  if (!isObjectId(id)) throw new ApiError(404, "Document not found.");
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || doc.isDeleted) throw new ApiError(404, "Document not found.");
  const r = await getScopedReferral(me, doc.referralId);
  const patientSide = me.role === "PATIENT" || me.role === "CLUSTER_MANAGER";
  const mine = me.role === "PATIENT"
    ? PATIENT_DOC_CATEGORIES.includes(doc.category)
    : me.role === "CLUSTER_MANAGER"
      ? r.raisedById === me.id && PATIENT_DOC_CATEGORIES.includes(doc.category)
      : doc.uploadedById === me.id || (!doc.uploadedByPatient && HOSPITAL_DOC_CATEGORIES.includes(doc.category));
  const editable = patientSide ? ["DRAFT", "INFO_REQUESTED"].includes(r.status) : ["VISITED", "UNDER_TREATMENT"].includes(r.status);
  if (!mine || !editable) throw new ApiError(403, "This file can no longer be removed.");
  await prisma.document.update({ where: { id }, data: { isDeleted: true } });
  await audit({ actor: me, action: "FILE_DELETE", entity: "Document", entityId: id, before: { fileName: doc.fileName }, req });
  return ok({ ok: true });
});

import { prisma } from "@/lib/prisma";
import { route, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { getScopedReferral, isObjectId } from "@/lib/scope";
import { signDownload } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { PATIENT_DOC_CATEGORIES } from "@/lib/constants";

// Permission check first, then a link that expires in 10 minutes.
// Cluster Managers never get medical documents.
export const GET = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "HOSPITAL_USER", "PATIENT", "CLUSTER_MANAGER"]);
  if (!isObjectId(id)) throw new ApiError(404, "Document not found.");
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || doc.isDeleted) throw new ApiError(404, "Document not found.");
  const ref = await getScopedReferral(me, doc.referralId);
  if (me.role === "CLUSTER_MANAGER" && !(ref.raisedById === me.id && PATIENT_DOC_CATEGORIES.includes(doc.category))) {
    throw new ApiError(403, "Medical documents are visible only to the patient, the hospital and the verification team.");
  }
  const url = await signDownload(doc.storageKey, doc.fileName, doc.mimeType);
  const download = new URL(req.url).searchParams.get("download") === "1";
  await audit({ actor: me, action: download ? "FILE_DOWNLOAD" : "FILE_VIEW", entity: "Document", entityId: doc.id, after: { referralId: doc.referralId, fileName: doc.fileName }, req });
  return ok({ url, expiresIn: 600 });
});

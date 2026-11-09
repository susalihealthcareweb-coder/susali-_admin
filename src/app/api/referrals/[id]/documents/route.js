import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { getScopedReferral } from "@/lib/scope";
import { audit } from "@/lib/audit";
import { isRaiser } from "@/lib/referral-owner";
import { ALLOWED_MIME, PATIENT_DOC_CATEGORIES, HOSPITAL_DOC_CATEGORIES } from "@/lib/constants";

export const GET = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "HOSPITAL_USER", "PATIENT"]);
  await getScopedReferral(me, id);
  const docs = await prisma.document.findMany({ where: { referralId: id, isDeleted: false }, orderBy: { createdAt: "asc" } });
  return ok({ documents: docs });
});

// Saves file metadata after the browser finished uploading to storage.
export const POST = route(async (req, { id }) => {
  const me = await requireApi(["PATIENT", "HOSPITAL_USER", "CLUSTER_MANAGER"]);
  const r = await getScopedReferral(me, id);
  if (me.role === "CLUSTER_MANAGER" && !isRaiser(me, r)) throw new ApiError(403, "Only the Cluster Manager who raised this referral can add files.");
  if (me.role !== "HOSPITAL_USER" && !["DRAFT", "INFO_REQUESTED"].includes(r.status)) throw new ApiError(409, "Files can be added only while the referral is a draft or needs information.");
  const input = await body(req, z.object({
    key: z.string().min(5),
    category: z.string(),
    fileName: z.string().min(1).max(200),
    mimeType: z.string(),
    size: z.number().int().positive(),
  }));
  if (!input.key.startsWith(`referrals/${r.id}/`)) throw new ApiError(400, "Upload key does not match this referral.");
  if (!ALLOWED_MIME.includes(input.mimeType)) throw new ApiError(400, "File type not allowed.");
  const allowed = me.role === "HOSPITAL_USER" ? HOSPITAL_DOC_CATEGORIES : PATIENT_DOC_CATEGORIES;
  if (!allowed.includes(input.category)) throw new ApiError(400, "Invalid category.");
  const doc = await prisma.document.create({
    data: {
      referralId: r.id,
      category: input.category,
      fileName: input.fileName,
      storageKey: input.key,
      mimeType: input.mimeType,
      sizeBytes: input.size,
      uploadedById: me.kind === "staff" ? me.id : null,
      uploadedByPatient: me.kind === "patient",
    },
  });
  await audit({ actor: me, action: "FILE_UPLOAD", entity: "Document", entityId: doc.id, after: { referralId: r.id, category: input.category, fileName: input.fileName }, req });
  return ok({ document: doc }, { status: 201 });
});

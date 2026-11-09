import { z } from "zod";
import { route, body, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { getScopedReferral, getScopedCompany } from "@/lib/scope";
import { signUpload, makeKey } from "@/lib/storage";
import { getSettings } from "@/lib/settings";
import { isRaiser } from "@/lib/referral-owner";
import { ALLOWED_MIME, PATIENT_DOC_CATEGORIES, HOSPITAL_DOC_CATEGORIES } from "@/lib/constants";

// Returns a short-lived URL the browser uploads the file to directly.
export const POST = route(async (req) => {
  const me = await requireApi(["PATIENT", "HOSPITAL_USER", "CLUSTER_MANAGER", "SUPER_ADMIN", "SUDO_ADMIN"]);
  const input = await body(req, z.object({
    purpose: z.enum(["referral", "visit-photo"]),
    referralId: z.string().optional(),
    companyId: z.string().optional(),
    category: z.string().optional(),
    fileName: z.string().min(1).max(200),
    mimeType: z.string(),
    size: z.number().int().positive(),
  }));
  const s = await getSettings();
  if (input.size > s.maxFileMb * 1024 * 1024) throw new ApiError(400, `Files must be ${s.maxFileMb} MB or smaller.`);
  if (!ALLOWED_MIME.includes(input.mimeType)) throw new ApiError(400, "Only PDF, JPG, PNG or ZIP (DICOM) files are allowed.");

  let prefix;
  if (input.purpose === "referral") {
    const r = await getScopedReferral(me, input.referralId);
    if (me.role === "PATIENT" || isRaiser(me, r)) {
      if (!PATIENT_DOC_CATEGORIES.includes(input.category)) throw new ApiError(400, "Invalid category.");
      if (!["DRAFT", "INFO_REQUESTED"].includes(r.status)) throw new ApiError(409, "Files can be added only while the referral is a draft or needs information.");
    } else if (me.role === "HOSPITAL_USER") {
      if (!HOSPITAL_DOC_CATEGORIES.includes(input.category)) throw new ApiError(400, "Invalid category.");
      if (!["VISITED", "UNDER_TREATMENT", "COMPLETED"].includes(r.status)) throw new ApiError(409, "Documents can be uploaded after the patient visits.");
    } else {
      throw new ApiError(403, "You cannot upload referral documents.");
    }
    prefix = `referrals/${r.id}`;
  } else {
    if (!["CLUSTER_MANAGER", "SUPER_ADMIN", "SUDO_ADMIN"].includes(me.role)) throw new ApiError(403, "Not allowed.");
    if (!input.mimeType.startsWith("image/")) throw new ApiError(400, "Visit photo must be an image.");
    const c = await getScopedCompany(me, input.companyId);
    prefix = `companies/${c.id}/visits`;
  }
  const key = makeKey(prefix, input.fileName);
  const signed = await signUpload({ key, mimeType: input.mimeType, size: input.size });
  return ok({ key, ...signed });
});

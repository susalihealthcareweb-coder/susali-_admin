import crypto from "node:crypto";
import path from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Private file storage on Cloudflare R2 (S3-compatible) with signed URLs.
// When R2_BUCKET is empty, files go to ./.uploads on this machine
// (development only).
export const cloudEnabled = () => Boolean(process.env.R2_BUCKET);
const DOWNLOAD_TTL = 10 * 60; // 10 minutes
const UPLOAD_TTL = 15 * 60;

export function r2Config() {
  const account = process.env.R2_ACCOUNT_ID;
  return {
    region: "auto", // required by the SDK, ignored by R2
    forcePathStyle: true, // https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
    endpoint: process.env.R2_ENDPOINT || (account ? `https://${account}.r2.cloudflarestorage.com` : undefined),
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID || "", secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "" },
    // Newer AWS SDKs add checksum headers to every request by default; keep
    // them to the operations that need them so signed URLs stay R2-friendly.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  };
}

let s3;
function client() {
  if (!s3) s3 = new S3Client(r2Config());
  return s3;
}

export function makeKey(prefix, fileName) {
  const ext = path.extname(fileName || "").toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 8);
  return `${prefix}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}${ext}`;
}

export function localSig(parts) {
  return crypto.createHmac("sha256", process.env.AUTH_SECRET || "dev").update(parts.join("|")).digest("hex");
}
export const LOCAL_ROOT = () => path.join(process.cwd(), ".uploads");

export async function signUpload({ key, mimeType, size }) {
  if (cloudEnabled()) {
    const url = await getSignedUrl(
      client(),
      new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, ContentType: mimeType, ContentLength: size }),
      { expiresIn: UPLOAD_TTL }
    );
    return { url, method: "PUT", headers: { "Content-Type": mimeType } };
  }
  const exp = Math.floor(Date.now() / 1000) + UPLOAD_TTL;
  const sig = localSig(["put", key, exp, size]);
  const q = new URLSearchParams({ key, exp: String(exp), size: String(size), sig });
  return { url: `/api/uploads/local?${q}`, method: "PUT", headers: { "Content-Type": mimeType } };
}

export async function signDownload(key, fileName, mimeType) {
  if (cloudEnabled()) {
    return getSignedUrl(
      client(),
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        ResponseContentDisposition: `inline; filename="${String(fileName).replace(/"/g, "")}"`,
        ResponseContentType: mimeType,
      }),
      { expiresIn: DOWNLOAD_TTL }
    );
  }
  const exp = Math.floor(Date.now() / 1000) + DOWNLOAD_TTL;
  const sig = localSig(["get", key, exp]);
  const q = new URLSearchParams({ key, exp: String(exp), name: fileName, type: mimeType || "", sig });
  return `/api/files?${q}`;
}

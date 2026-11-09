// Checks the Cloudflare R2 setup end to end, the same way the app uses it:
// signed upload (PUT) from a "browser", signed download (GET), then clean-up.
// Run: node --env-file=.env scripts/r2-check.mjs [https://your-site-origin]
import { S3Client, DeleteObjectCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import { signUpload, signDownload, r2Config, cloudEnabled } from "../src/lib/storage.js";

const origin = process.argv[2] || process.env.APP_URL || "http://localhost:3000";
if (!cloudEnabled()) {
  console.log("R2_BUCKET is empty: the site is using local development storage.");
  process.exit(1);
}
const key = `healthcheck/${Date.now()}.txt`;
const body = new TextEncoder().encode("SUSALI R2 check");
let ok = true;
const step = (label, pass, info = "") => { if (!pass) ok = false; console.log(`${pass ? "PASS" : "FAIL"}  ${label}${pass ? "" : `  → ${info}`}`); };

const up = await signUpload({ key, mimeType: "text/plain", size: body.length });
const put = await fetch(up.url, { method: "PUT", headers: { "Content-Type": "text/plain", Origin: origin }, body });
step("signed upload (PUT)", put.ok, `${put.status} ${await put.text().catch(() => "")}`.slice(0, 300));
step("CORS allows uploads from " + origin, put.headers.get("access-control-allow-origin") === origin || put.headers.get("access-control-allow-origin") === "*", "add the CORS policy from the README");

const url = await signDownload(key, "check.txt", "text/plain");
const get = await fetch(url);
step("signed download (GET)", get.ok && (await get.text()) === "SUSALI R2 check", get.status);

const s3 = new S3Client(r2Config());
try {
  const cors = await s3.send(new GetBucketCorsCommand({ Bucket: process.env.R2_BUCKET }));
  step("bucket has a CORS policy", (cors.CORSRules || []).length > 0, "none set");
} catch (e) {
  step("bucket has a CORS policy", false, e.name);
}
await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key })).catch(() => {});
console.log(ok ? "\nR2 is ready." : "\nFix the failures above.");
process.exit(ok ? 0 : 1);

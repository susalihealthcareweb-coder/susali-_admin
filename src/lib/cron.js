import { ApiError } from "./api";

// Cron routes accept `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this)
// or ?secret=<CRON_SECRET>.
export function checkCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ApiError(500, "CRON_SECRET is not set.");
  const auth = req.headers.get("authorization");
  const q = new URL(req.url).searchParams.get("secret");
  if (auth !== `Bearer ${secret}` && q !== secret) throw new ApiError(401, "Unauthorized");
}

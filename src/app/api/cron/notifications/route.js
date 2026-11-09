import { route, ok } from "@/lib/api";
import { checkCron } from "@/lib/cron";
import { processQueue } from "@/lib/notify";

// Sends queued WhatsApp and email messages and retries failures (1, 5, 15 min).
export const GET = route(async (req) => {
  checkCron(req);
  return ok(await processQueue(200));
});

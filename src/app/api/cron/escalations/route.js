import { route, ok } from "@/lib/api";
import { checkCron } from "@/lib/cron";
import { runEscalations } from "@/lib/jobs";

// Time-limit escalations and auto-close (see lib/jobs.js).
export const GET = route(async (req) => {
  checkCron(req);
  return ok(await runEscalations());
});

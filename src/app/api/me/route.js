import { route, ok } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { profileOf } from "@/lib/mobile-auth";

// The signed-in person's profile (used by the mobile app on start-up).
export const GET = route(async () => {
  const me = await requireApi();
  return ok({ me: await profileOf(me) });
});

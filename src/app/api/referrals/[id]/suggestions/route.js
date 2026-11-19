import { route, ok } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { getScopedReferral } from "@/lib/scope";
import { suggestHospitals } from "@/lib/hospital-suggest";

// Hospital suggestions for the verification team.
export const GET = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT"]);
  const r = await getScopedReferral(me, id);
  return ok({ rows: await suggestHospitals(r) });
});

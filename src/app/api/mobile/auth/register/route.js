import { route, body } from "@/lib/api";
import { registerSchema, registerEmployee } from "@/lib/register";
import { mobileSession } from "@/lib/mobile-auth";

// Mobile app self-registration: same rules as the website, returns a token.
export const POST = route(async (req) => {
  const input = await body(req, registerSchema);
  const employee = await registerEmployee(input, req);
  return mobileSession({ id: employee.id, role: "PATIENT" });
});

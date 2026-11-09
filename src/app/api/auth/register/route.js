import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { route, body, ok } from "@/lib/api";
import { makeLoginToken } from "@/lib/otp";
import { registerSchema, registerEmployee } from "@/lib/register";

// Website self-registration: creates the employee, then signs them in.
export const POST = route(async (req) => {
  const input = await body(req, registerSchema);
  const employee = await registerEmployee(input, req);
  try {
    await signIn("patient", { mobile: employee.mobile, token: makeLoginToken(employee.id), redirect: false });
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    return ok({ ok: true, redirect: "/login" });
  }
  return ok({ ok: true, redirect: "/patient" });
});

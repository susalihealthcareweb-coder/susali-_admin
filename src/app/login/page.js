import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { homeFor } from "@/lib/constants";
import AuthLayout from "@/components/AuthLayout";
import LoginForm from "./LoginForm";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }) {
  const me = await getCurrentUser();
  const sp = await searchParams;
  if (me) redirect(homeFor(me.role));
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "";
  return (
    <AuthLayout title="Welcome back" subtitle="Log in with your mobile OTP or your email.">
      <LoginForm next={next} initialMode={sp.mode === "email" ? "email" : "otp"} />
    </AuthLayout>
  );
}

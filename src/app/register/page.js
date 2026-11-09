import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { homeFor } from "@/lib/constants";
import AuthLayout from "@/components/AuthLayout";
import RegisterWizard from "./RegisterWizard";

export const metadata = { title: "Register" };

export default async function RegisterPage() {
  const me = await getCurrentUser();
  if (me) redirect(homeFor(me.role));
  return (
    <AuthLayout title="Register as an employee" subtitle="Takes about two minutes. Your Cluster Manager approves it before you can raise referrals.">
      <RegisterWizard />
    </AuthLayout>
  );
}

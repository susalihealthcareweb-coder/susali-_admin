import { redirect } from "next/navigation";

// Old link: patients now use the OTP side of the single login page.
export default function Page() {
  redirect("/login?mode=otp");
}

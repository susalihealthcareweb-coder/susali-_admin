import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { homeFor } from "@/lib/constants";
import { Brand, FullLogo, Waves } from "@/components/Brand";
import Icon from "@/components/Icon";

const STEPS = [
  ["referral", "Submit", "Enter the referral letter for yourself or a family member"],
  ["shield", "Verified", "Our team checks it before any hospital sees it"],
  ["building", "Treated", "The hospital accepts you and records your visit"],
  ["folder", "Records", "Prescriptions and reports land on your phone"],
];

export default async function Home() {
  const me = await getCurrentUser();
  if (me) redirect(homeFor(me.role));
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#faf6ef]">
      <Waves className="absolute left-0 top-0 h-40 w-[75%] sm:h-56 sm:w-[55%]" />
      <Waves className="absolute bottom-0 right-0 h-40 w-[75%] sm:h-56 sm:w-[55%]" flip />
      <header className="relative mx-auto flex max-w-6xl items-center justify-end px-4 py-5 sm:px-6">
        <Link href="/login" className="btn-secondary">Log in</Link>
      </header>
      <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-28 pt-6 sm:px-6 lg:grid-cols-2 lg:pt-12">
        <div className="order-2 text-center lg:order-1 lg:text-left">
          <span className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-wide text-gold-700 shadow-sm ring-1 ring-gold-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-500" /> HEALTHIER LIVES AHEAD</span>
          <h1 className="animate-fade-up mt-5 text-5xl leading-[1.05] text-brand-900 sm:text-6xl" style={{ animationDelay: "0.08s" }}>
            Hospital referrals, <span className="text-gold-gradient">beautifully simple</span>.
          </h1>
          <p className="animate-fade-up mx-auto mt-5 max-w-xl text-base text-slate-600 sm:text-lg lg:mx-0" style={{ animationDelay: "0.16s" }}>From the dispensary letter to the hospital report — for you and your family, verified, notified on WhatsApp and stored safely.</p>
          <div className="animate-fade-up mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start" style={{ animationDelay: "0.24s" }}>
            <Link href="/login" className="btn-primary group px-7 py-3 text-base">Log in <Icon name="arrowRight" size={17} className="transition-transform group-hover:translate-x-1" /></Link>
            <Link href="/register" className="btn-secondary px-7 py-3 text-base">Register as employee</Link>
          </div>
        </div>
        <div className="order-1 flex justify-center lg:order-2">
          <div className="animate-scale-in relative">
            <span className="absolute inset-6 rounded-full bg-gold-200/40 blur-3xl" />
            <FullLogo width={340} className="relative drop-shadow-[0_18px_30px_rgba(11,70,51,0.18)]" />
          </div>
        </div>
        <div className="stagger order-3 grid gap-4 text-left sm:grid-cols-2 lg:col-span-2 lg:grid-cols-4">
          {STEPS.map(([icon, title, text], i) => (
            <div key={title} className="lift card card-pad">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-gold-200 shadow-sm"><Icon name={icon} size={20} /></span>
                <span className="text-xs font-semibold tracking-widest text-gold-600">STEP {i + 1}</span>
              </div>
              <h3 className="font-display mt-3 text-xl font-bold text-brand-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="relative space-y-2 pb-6 text-center">
        <Brand size={26} />
        <p className="text-xs text-slate-500"><Link className="hover:underline" href="/privacy">Privacy policy</Link> · <Link className="hover:underline" href="/account-deletion">Delete your account</Link></p>
      </footer>
    </main>
  );
}

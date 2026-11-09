import Link from "next/link";
import { Brand, FullLogo, Waves } from "./Brand";

// Split screen in the logo's style: cream with emerald and gold sweeps.
export default function AuthLayout({ children, title, subtitle }) {
  return (
    <main className="grid min-h-screen bg-[#faf6ef] lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12">
        <Waves className="absolute left-0 top-0 h-48 w-[70%]" />
        <Waves className="absolute bottom-0 right-0 h-48 w-[70%]" flip />
        <div className="relative flex max-w-md flex-col items-center text-center">
          <Link href="/" className="animate-scale-in transition-transform duration-500 hover:scale-[1.02]"><FullLogo width={300} /></Link>
          <p className="animate-fade-up mt-6 text-brand-800/80" style={{ animationDelay: "0.15s" }}>From the dispensary letter to the hospital report — every referral verified, tracked and safely stored.</p>
          <ul className="stagger mt-7 space-y-2.5 text-left text-sm text-brand-900">
            {["Raise a referral for yourself or your family", "Verified before any hospital sees it", "WhatsApp updates at every step", "Prescriptions and reports in one place"].map((t) => (
              <li key={t} className="flex items-center gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 text-[11px] font-bold text-white shadow-sm">✓</span>{t}</li>
            ))}
          </ul>
        </div>
      </aside>
      <section className="relative flex flex-col overflow-hidden bg-white px-4 py-8 sm:px-8 lg:justify-center lg:border-l lg:border-gold-200/60">
        <Waves className="absolute left-0 top-0 h-20 w-full opacity-95 lg:hidden" />
        <Link href="/" className="relative mb-8 mt-12 flex justify-center lg:hidden"><Brand size={44} /></Link>
        <div className="relative mx-auto w-full max-w-md">
          {title && (
            <div className="animate-fade-up mb-6">
              <h1 className="text-3xl text-brand-900">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
              <div className="gold-rule mt-4 w-24 opacity-80" />
            </div>
          )}
          {children}
        </div>
      </section>
    </main>
  );
}

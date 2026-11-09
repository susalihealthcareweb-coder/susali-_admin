"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Brand } from "./Brand";
import Icon from "./Icon";

const NAV = [
  ["Home", "/patient", "home"],
  ["Referrals", "/patient/referrals", "referral"],
  ["Records", "/patient/records", "folder"],
  ["Alerts", "/patient/notifications", "bell"],
  ["Profile", "/patient/profile", "user"],
];

export default function PatientShell({ name, unread, children }) {
  const pathname = usePathname();
  const active = (href) => (href === "/patient" ? pathname === href : pathname.startsWith(href));
  const activeIndex = Math.max(0, NAV.findIndex(([, h]) => active(h)));
  return (
    <div className="min-h-screen bg-gradient-to-b from-gold-50 via-[#faf6ef] to-[#faf6ef]">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/patient" className="transition-transform duration-300 hover:scale-[1.03]"><Brand size={32} /></Link>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-slate-600 sm:inline">{name}</span>
            <button className="btn-ghost btn-sm text-slate-500" onClick={() => signOut({ callbackUrl: "/login" })}><Icon name="logout" size={15} /> <span className="hidden sm:inline">Sign out</span></button>
          </div>
        </div>
        <div className="gold-rule opacity-60" />
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-32 pt-5">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="relative mx-auto grid max-w-2xl grid-cols-5">
          <span className="absolute top-1.5 h-10 rounded-xl bg-gold-50 ring-1 ring-gold-200 transition-all duration-300 ease-out" style={{ width: "calc(20% - 12px)", left: `calc(${activeIndex * 20}% + 6px)` }} />
          {NAV.map(([label, href, icon]) => {
            const on = active(href);
            return (
              <Link key={href} href={href} className={`relative flex flex-col items-center gap-0.5 pb-2 pt-2.5 text-[11px] font-medium transition-colors ${on ? "text-brand-700" : "text-slate-500 hover:text-slate-700"}`}>
                <span className={`relative transition-transform duration-200 ${on ? "scale-110" : ""}`}>
                  <Icon name={icon} size={20} />
                  {label === "Alerts" && unread > 0 && <span className="animate-pulse-ring absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-red-600" />}
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

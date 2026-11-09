"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import Icon from "./Icon";
import { Brand } from "./Brand";

export default function StaffShell({ nav, base, user, roleLabel, badges = {}, children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isActive = (href) => (href === base ? pathname === base : pathname.startsWith(href));
  const mobile = nav.filter((n) => n.mobile);
  const badge = (n) => badges[n.label] || 0;

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const links = (
    <nav className="space-y-0.5">
      {nav.map((n, i) => {
        const active = isActive(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            style={open ? { animation: `slide-in-from-right 0.35s ${0.03 * i}s both` } : undefined}
            className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:translate-x-0.5 hover:bg-slate-100 hover:text-slate-900"}`}
          >
            <span className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-gold-300 to-gold-600 transition-all duration-300 ${active ? "opacity-100" : "scale-y-0 opacity-0"}`} />
            <Icon name={n.icon} size={17} className={`shrink-0 transition-colors ${active ? "text-brand-700" : "text-slate-400 group-hover:text-slate-600"}`} />
            <span className="flex-1">{n.label}</span>
            {badge(n) > 0 && <span className="animate-pop rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">{badge(n)}</span>}
          </Link>
        );
      })}
    </nav>
  );
  const account = (
    <div className="border-t border-slate-200 p-3">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-sm font-semibold text-gold-100 ring-2 ring-gold-300/60">{user.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-900">{user.name}</div>
          <div className="truncate text-xs text-slate-500">{roleLabel}</div>
        </div>
      </div>
      <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-ghost btn-sm mt-2 w-full justify-start text-slate-600"><Icon name="logout" size={15} /> Sign out</button>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[#ebe3d3] bg-white lg:flex">
        <Link href={base} className="group block px-5 pb-3 pt-5"><span className="inline-block transition-transform duration-300 group-hover:scale-[1.03]"><Brand size={38} /></span></Link>
        <div className="gold-rule mx-5 mb-3 opacity-70" />
        <div className="flex-1 overflow-y-auto px-3">{links}</div>
        {account}
      </aside>

      <header className={`sticky top-0 z-30 flex items-center justify-between border-b bg-white/90 px-4 py-3 backdrop-blur transition-shadow lg:hidden ${scrolled ? "border-slate-200 shadow-sm" : "border-transparent"}`}>
        <Link href={base}><Brand size={30} /></Link>
        <div className="flex items-center gap-1">
          <Link href={base + "/notifications"} className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 active:scale-90" aria-label="Alerts">
            <Icon name="bell" size={20} />
            {badges.Alerts > 0 && <span className="animate-pulse-ring absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-600" />}
          </Link>
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 active:scale-90" aria-label="Menu"><Icon name="menu" size={20} /></button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-[min(18rem,85vw)] flex-col bg-white shadow-2xl" style={{ animation: "slide-in-right 0.3s cubic-bezier(0.2,0.8,0.2,1)" }}>
            <div className="flex items-center justify-between px-4 py-3"><span className="font-semibold">Menu</span><button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-500 transition hover:rotate-90 hover:bg-slate-100" aria-label="Close menu"><Icon name="x" /></button></div>
            <div className="flex-1 overflow-y-auto px-3">{links}</div>
            {account}
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" style={{ gridTemplateColumns: `repeat(${mobile.length}, minmax(0, 1fr))` }}>
        {mobile.map((n) => {
          const active = isActive(n.href);
          return (
            <Link key={n.href} href={n.href} className={`relative flex flex-col items-center gap-0.5 px-1 pb-2 pt-2.5 text-[10.5px] font-medium transition-colors ${active ? "text-brand-700" : "text-slate-500"}`}>
              <span className={`absolute top-0 h-0.5 rounded-full bg-gold-500 transition-all duration-300 ${active ? "w-8 opacity-100" : "w-0 opacity-0"}`} />
              <span className={`relative transition-transform duration-200 ${active ? "-translate-y-0.5 scale-110" : ""}`}>
                <Icon name={n.icon} size={20} />
                {badge(n) > 0 && <span className="absolute -right-2 -top-1 rounded-full bg-red-600 px-1 text-[9px] leading-tight text-white">{badge(n)}</span>}
              </span>
              {n.label.replace("Verification Queue", "Queue")}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export { Logo } from "./Brand";

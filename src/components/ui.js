import Link from "next/link";
import { STATUS, URGENCY } from "@/lib/constants";
import CountUp from "./CountUp";

const TONES = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  gray: "bg-gray-100 text-gray-600 ring-gray-200",
  stone: "bg-stone-100 text-stone-600 ring-stone-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  cyan: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  teal: "bg-brand-50 text-brand-800 ring-brand-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  green: "bg-green-50 text-green-700 ring-green-200",
};

export function Badge({ tone = "slate", children, className = "" }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}>{children}</span>;
}
export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, tone: "slate" };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
export function UrgencyBadge({ urgency }) {
  if (!urgency || urgency === "ROUTINE") return <Badge tone="slate">Routine</Badge>;
  return <Badge tone={URGENCY[urgency].tone}>{URGENCY[urgency].label}</Badge>;
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && <Link href={back.href} className="mb-1 inline-block text-xs font-medium text-slate-500 hover:text-slate-800">← {back.label}</Link>}
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, href, hint, tone }) {
  const inner = (
    <div className={`card card-pad group relative h-full overflow-hidden ${href ? "lift hover:border-brand-500" : ""}`}>
      <span className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-brand-50 opacity-0 transition-all duration-300 group-hover:scale-150 group-hover:opacity-100" />
      <div className="relative text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`relative mt-1 text-2xl font-semibold tabular-nums ${tone === "warn" && value > 0 ? "text-amber-700" : tone === "bad" && value > 0 ? "text-red-700" : "text-slate-900"}`}><CountUp value={value} /></div>
      {hint && <div className="relative mt-0.5 text-xs text-slate-500">{hint}</div>}
      {href && <span className="absolute bottom-3 right-3 translate-x-1 text-brand-600 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">→</span>}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

export function Empty({ title = "Nothing here yet", children }) {
  return (
    <div className="animate-scale-in rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-xl text-brand-600">✦</div>
      <div className="text-sm font-medium text-slate-700">{title}</div>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Section({ title, actions, children, className = "" }) {
  return (
    <section className={`card transition-shadow duration-300 hover:shadow-[0_4px_16px_-8px_rgba(15,23,42,0.12)] ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-900">{children || "—"}</dd>
    </div>
  );
}

// Link-based tabs that keep other query params.
export function Tabs({ tabs, active }) {
  return (
    <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95 ${active === t.key ? "bg-brand-700 text-white shadow-sm shadow-brand-700/30" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:-translate-y-0.5 hover:bg-slate-50"}`}>
          {t.label}
          {t.count != null && <span className={`ml-1.5 tabular-nums ${active === t.key ? "text-brand-100" : "text-slate-400"}`}>{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}

export function Pagination({ page, pages, makeHref }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-slate-500">Page {page} of {pages}</span>
      <div className="flex gap-2">
        {page > 1 ? <Link className="btn-secondary btn-sm" href={makeHref(page - 1)}>Previous</Link> : <span className="btn-secondary btn-sm opacity-40">Previous</span>}
        {page < pages ? <Link className="btn-secondary btn-sm" href={makeHref(page + 1)}>Next</Link> : <span className="btn-secondary btn-sm opacity-40">Next</span>}
      </div>
    </div>
  );
}

// Single-series horizontal bars (one hue, value labelled, no legend needed).
export function BarList({ items, empty = "No data yet", href }) {
  if (!items?.length) return <p className="text-sm text-slate-500">{empty}</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-2">
      {items.map((i) => {
        const row = (
          <div className="group" title={`${i.label}: ${i.count}`}>
            <div className="mb-0.5 flex justify-between gap-2 text-xs">
              <span className="truncate text-slate-700">{i.label}</span>
              <span className="tabular-nums font-medium text-slate-900">{i.count}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="animate-grow-x h-2 rounded-full bg-brand-600 transition-colors group-hover:bg-brand-800" style={{ width: `${Math.max(2, (i.count / max) * 100)}%` }} />
            </div>
          </div>
        );
        return <li key={i.label}>{href && i.href ? <Link href={i.href}>{row}</Link> : row}</li>;
      })}
    </ul>
  );
}

// Vertical monthly columns, single series.
export function MonthBars({ months }) {
  const max = Math.max(...months.map((m) => m.count), 1);
  return (
    <div>
      <div className="flex h-36 items-end gap-1.5">
        {months.map((m) => (
          <div key={m.key} className="group relative flex h-full flex-1 flex-col justify-end" title={`${m.label}: ${m.count} referrals`}>
            <span className="mb-1 text-center text-[10px] tabular-nums text-slate-500 opacity-0 group-hover:opacity-100">{m.count}</span>
            <div className="animate-grow-y rounded-t bg-brand-600 transition-colors group-hover:bg-brand-800" style={{ height: `${(m.count / max) * 100}%`, minHeight: m.count ? 3 : 1 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 border-t border-slate-200 pt-1">
        {months.map((m) => <span key={m.key} className="flex-1 text-center text-[10px] text-slate-500">{m.label}</span>)}
      </div>
    </div>
  );
}

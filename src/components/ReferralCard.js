import Link from "next/link";
import { StatusBadge, UrgencyBadge } from "./ui";
import PatientLabel from "./PatientLabel";
import Icon from "./Icon";
import { fmtDateTime } from "@/lib/format";

const URGENT_EDGE = { EMERGENCY: "before:bg-red-500", URGENT: "before:bg-amber-400", ROUTINE: "before:bg-transparent" };

// One referral as a card. Cards sit in a responsive grid, so lists never
// need a sideways scroll bar.
export default function ReferralCard({ r, href, me, actions, waiting }) {
  const lockedByOther = r.status === "UNDER_VERIFICATION" && r.lockedById && r.lockedById !== me?.id;
  return (
    <article className={`lift card relative flex flex-col overflow-hidden before:absolute before:inset-y-0 before:left-0 before:w-1 ${URGENT_EDGE[r.urgency] || ""} ${lockedByOther ? "opacity-75" : ""}`}>
      <Link href={href} className="block flex-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <PatientLabel r={r} />
          <StatusBadge status={r.status} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-brand-700">{r.referralNo}</span>
          <UrgencyBadge urgency={r.urgency} />
        </div>
        <dl className="mt-3 space-y-1.5 text-xs text-slate-600">
          <div className="flex items-center gap-2"><Icon name="building" size={14} className="shrink-0 text-gold-600" /><dd className="truncate">{r.companyName || "—"}</dd></div>
          <div className="flex items-center gap-2"><Icon name="heart" size={14} className="shrink-0 text-gold-600" /><dd className="truncate">{r.hospital?.name || "Hospital not chosen"}{r.department ? ` · ${r.department.name}` : ""}</dd></div>
          <div className="flex items-center gap-2"><Icon name="clock" size={14} className="shrink-0 text-gold-600" /><dd className="truncate">{waiting ? "Waiting since " : "Updated "}{fmtDateTime(waiting ? r.submittedAt || r.createdAt : r.updatedAt)}</dd></div>
        </dl>
        {r.status === "UNDER_VERIFICATION" && r.lockedBy && (
          <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${lockedByOther ? "bg-amber-50 text-amber-800" : "bg-brand-50 text-brand-800"}`}>🔒 {lockedByOther ? `${r.lockedBy.name} is reviewing` : "You are reviewing"}</div>
        )}
      </Link>
      {actions && <div className="border-t border-[#efe7d6] bg-[#fdfbf7] px-4 py-3">{actions}</div>}
    </article>
  );
}

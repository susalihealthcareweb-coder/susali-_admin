import { STATUS, ROLES } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";

// Full history of a referral: who acted, when, and remarks.
export default function Timeline({ history, hideActorNames }) {
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {history.map((h) => {
        const actor = h.actorIsPatient ? "Patient" : h.actorUser ? (hideActorNames ? ROLES[h.actorUser.role]?.label : `${h.actorUser.name} · ${ROLES[h.actorUser.role]?.label}`) : "System";
        return (
          <li key={h.id} className="relative">
            <span className={`absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${dot(h.toStatus)}`} />
            <div className="text-sm font-medium text-slate-900">{STATUS[h.toStatus]?.label}{h.fromStatus === h.toStatus ? " (update)" : ""}</div>
            <div className="text-xs text-slate-500">{fmtDateTime(h.createdAt)} · {actor}</div>
            {h.remarks && <div className="mt-1 whitespace-pre-line text-sm text-slate-600">{h.remarks}</div>}
          </li>
        );
      })}
    </ol>
  );
}

function dot(s) {
  if (["REJECTED", "CANCELLED"].includes(s)) return "bg-red-500";
  if (["HOSPITAL_DECLINED", "INFO_REQUESTED"].includes(s)) return "bg-amber-500";
  if (["COMPLETED", "CLOSED"].includes(s)) return "bg-green-600";
  return "bg-brand-600";
}

import { patientOf } from "@/lib/format";

// Patient name for lists; family members show their relation and the card holder.
export default function PatientLabel({ r, showCode = true }) {
  const p = patientOf(r);
  const family = p.relation !== "Self";
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="truncate font-medium text-slate-900">{p.name}</span>
        {family && <span className="shrink-0 rounded-full bg-gold-50 px-1.5 py-px text-[10px] font-semibold text-gold-700 ring-1 ring-gold-200">{p.relation}</span>}
      </div>
      {(showCode || family) && (
        <div className="truncate text-xs text-slate-500">
          {family ? `Card: ${r.employee?.fullName || r.patientSnapshot?.name || ""}` : ""}{family && showCode ? " · " : ""}{showCode ? (r.employee?.employeeCode || r.patientSnapshot?.employeeCode) : ""}
        </div>
      )}
    </div>
  );
}

import { ageFrom } from "@/lib/format";

export default function PatientCard({ e }) {
  return (
    <div className="card card-pad text-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Card holder (from your employee record)</div>
      <div className="font-medium">{e.fullName}</div>
      <div className="text-slate-600">{ageFrom(e.dateOfBirth)} yrs · {e.gender}{e.bloodGroup ? ` · ${e.bloodGroup}` : ""} · {e.mobile}</div>
      <div className="text-slate-600">Emp ID {e.employeeCode} · {e.company?.name}</div>
      <p className="mt-1 text-xs text-slate-400">If anything here is wrong, ask your Cluster Manager to correct it.</p>
    </div>
  );
}

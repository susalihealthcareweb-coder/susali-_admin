"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "./Dialog";
import { api, run } from "./api-client";
import { VisitFields } from "./CompanyForm";
import { GENDERS, BLOOD_GROUPS } from "@/lib/constants";
import { toInputDate } from "@/lib/format";

export function LogVisit({ companyId }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [visit, setVisit] = useState({ visitedAt: new Date().toISOString().slice(0, 16), remarks: "", latitude: null, longitude: null });
  const save = async () => {
    setBusy(true);
    const ok = await run(() => api(`/api/companies/${companyId}/visits`, { method: "POST", data: { ...visit, visitedAt: new Date(visit.visitedAt).toISOString() } }), "Visit logged");
    setBusy(false);
    if (ok) { setOpen(false); router.refresh(); }
  };
  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>Log visit</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Log a visit" wide footer={<><button className="btn-secondary" onClick={() => setOpen(false)}>Back</button><button className="btn-primary" disabled={busy} onClick={save}>Save visit</button></>}>
        <VisitFields visit={visit} setVisit={setVisit} companyId={companyId} showPhoto />
      </Dialog>
    </>
  );
}

export function CompanyStatusToggle({ id, isActive }) {
  const router = useRouter();
  return (
    <button className={isActive ? "btn-ghost text-red-700" : "btn-secondary"} onClick={async () => {
      if (isActive && !confirm("Deactivate this company? Its employees will not be able to raise referrals.")) return;
      if (await run(() => api(`/api/companies/${id}`, { method: "PATCH", data: { isActive: !isActive } }), isActive ? "Company deactivated" : "Company activated")) router.refresh();
    }}>{isActive ? "Deactivate" : "Activate"}</button>
  );
}

const EMPTY = { employeeCode: "", fullName: "", gender: "Male", dateOfBirth: "", mobile: "", email: "", aadhaarLast4: "", department: "", designation: "", bloodGroup: "", address: "", emergencyName: "", emergencyMobile: "" };

export function EmployeeDialog({ companyId, employee, trigger }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState(() => (employee ? { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, employee[k] ?? ""])), dateOfBirth: toInputDate(employee.dateOfBirth) } : EMPTY));
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await run(() => api(employee ? `/api/employees/${employee.id}` : `/api/companies/${companyId}/employees`, { method: employee ? "PATCH" : "POST", data: v }), employee ? "Employee saved" : "Employee added; WhatsApp welcome queued");
    setBusy(false);
    if (ok) { setOpen(false); if (!employee) setV(EMPTY); router.refresh(); }
  };
  const F = (k, label, props = {}) => (
    <div className={props.full ? "sm:col-span-2" : ""}><label className="label">{label}{props.required ? " *" : ""}</label><input className="input" value={v[k]} onChange={set(k)} {...props} full={undefined} /></div>
  );
  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger || <button className="btn-primary">Add employee</button>}</span>
      <Dialog open={open} onClose={() => setOpen(false)} title={employee ? "Edit employee" : "Add employee"} wide footer={<><button className="btn-secondary" onClick={() => setOpen(false)}>Back</button><button className="btn-primary" form="f-emp" disabled={busy}>{busy ? "Saving…" : "Save"}</button></>}>
        <form id="f-emp" onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          {F("employeeCode", "Employee ID", { required: true })}
          {F("fullName", "Full name", { required: true })}
          <div><label className="label">Gender *</label><select className="input" value={v.gender} onChange={set("gender")}>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select></div>
          {F("dateOfBirth", "Date of birth", { required: true, type: "date" })}
          {F("mobile", "Mobile (used for OTP login)", { required: true, inputMode: "numeric", maxLength: 13 })}
          {F("email", "Email", { type: "email" })}
          {F("aadhaarLast4", "Aadhaar last 4 digits", { inputMode: "numeric", maxLength: 4 })}
          {F("department", "Department")}
          {F("designation", "Designation")}
          <div><label className="label">Blood group</label><select className="input" value={v.bloodGroup} onChange={set("bloodGroup")}><option value="">—</option>{BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}</select></div>
          {F("address", "Address", { full: true })}
          {F("emergencyName", "Emergency contact name")}
          {F("emergencyMobile", "Emergency contact mobile", { inputMode: "numeric" })}
        </form>
      </Dialog>
    </>
  );
}

export function EmployeeStatusToggle({ id, isActive }) {
  const router = useRouter();
  return (
    <button className={`btn-ghost btn-sm ${isActive ? "text-red-700" : ""}`} onClick={async () => {
      if (isActive && !confirm("Mark this employee inactive? They will not be able to log in or raise referrals.")) return;
      if (await run(() => api(`/api/employees/${id}`, { method: "PATCH", data: { isActive: !isActive } }), isActive ? "Marked inactive" : "Reactivated")) router.refresh();
    }}>{isActive ? "Deactivate" : "Reactivate"}</button>
  );
}

// Excel/CSV bulk upload with a downloadable error report.
export function BulkUpload({ companyId }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    const res = await run(() => api(`/api/companies/${companyId}/employees/bulk`, { method: "POST", form }));
    setBusy(false);
    if (res) { setResult(res); router.refresh(); }
  };
  const downloadErrors = () => {
    const csv = ["Row,Employee ID,Error", ...result.errors.map((e) => [e.row, e.employeeCode, e.error].map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "employee-upload-errors.csv";
    a.click();
  };
  return (
    <>
      <button className="btn-secondary" onClick={() => { setResult(null); setOpen(true); }}>Bulk upload</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Bulk upload employees" footer={<button className="btn-secondary" onClick={() => setOpen(false)}>Done</button>}>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li><a className="link" href={`/api/companies/${companyId}/employees/template`}>Download the Excel template</a>.</li>
          <li>Fill one employee per row. Dates as YYYY-MM-DD.</li>
          <li>Upload the .xlsx or a .csv with the same columns.</li>
        </ol>
        <label className={`btn-primary cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
          {busy ? "Checking rows…" : "Choose file"}
          <input type="file" className="hidden" accept=".xlsx,.csv" onChange={(e) => { upload(e.target.files[0]); e.target.value = ""; }} />
        </label>
        {result && (
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
            <p><b className="text-green-700">{result.saved}</b> saved, <b className={result.rejected ? "text-red-700" : ""}>{result.rejected}</b> rejected, of {result.total} rows.</p>
            {result.errors.length > 0 && (
              <>
                <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-xs text-red-700">
                  {result.errors.slice(0, 50).map((e) => <li key={e.row}>Row {e.row}{e.employeeCode ? ` (${e.employeeCode})` : ""}: {e.error}</li>)}
                </ul>
                <button className="btn-secondary btn-sm mt-2" onClick={downloadErrors}>Download error report</button>
              </>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}

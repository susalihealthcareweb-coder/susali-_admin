"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, uploadFile, guessType } from "./api-client";
import { toast } from "./Toaster";
import Icon from "./Icon";

// Short referral form: who it's for, the referral letter number and the
// department. SUSALI chooses the hospital during verification. A photo of
// the letter is optional but speeds up verification.
export default function ReferralForm({ referral, masters, family = [], holder, employeeId, basePath = "/patient/referrals", familyHref = "/patient/profile#family", hasLetter }) {
  const router = useRouter();
  const staff = Boolean(employeeId || holder?.staff);
  const [who, setWho] = useState(referral?.familyMemberId || "");
  const [letterNo, setLetterNo] = useState(referral?.referralLetterNo || "");
  const [departmentId, setDepartmentId] = useState(referral?.departmentId || "");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const departments = masters?.departments || [];
  const people = [{ id: "", fullName: holder?.name || "Myself", relation: "Self" }, ...family];
  const resubmit = referral?.status === "INFO_REQUESTED";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!letterNo.trim()) return setError("Enter the referral letter number.");
    if (!departmentId) return setError("Choose the department.");
    setBusy(true);
    try {
      const data = { familyMemberId: who || null, referralLetterNo: letterNo.trim(), departmentId };
      const r = referral
        ? (await api(`/api/referrals/${referral.id}`, { method: "PATCH", data })).referral
        : (await api("/api/referrals", { method: "POST", data: { ...data, ...(employeeId ? { employeeId } : {}) } })).referral;
      if (file) {
        const key = await uploadFile(file, { purpose: "referral", referralId: r.id, category: "REFERRAL_LETTER" });
        await api(`/api/referrals/${r.id}/documents`, { method: "POST", data: { key, category: "REFERRAL_LETTER", fileName: file.name, mimeType: file.type || guessType(file.name), size: file.size } });
      }
      await api(`/api/referrals/${r.id}/submit`, { method: "POST", data: {} });
      toast(resubmit ? "Referral resubmitted" : "Referral submitted. SUSALI will choose the hospital and update you.");
      router.push(`${basePath}/${r.id}`);
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset className="card card-pad">
        <h3 className="font-display text-lg font-bold text-brand-900">Who is this referral for?</h3>
        <p className="mb-3 text-xs text-slate-500">{staff ? "The employee or a family member on their card." : "You or a family member on your card."}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {people.map((m) => {
            const on = who === m.id;
            return (
              <button key={m.id || "self"} type="button" onClick={() => setWho(m.id)} className={`flex items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 active:scale-[0.98] ${on ? "bg-gradient-to-br from-brand-700 to-brand-900 text-white shadow-md ring-2 ring-gold-400" : "bg-white ring-1 ring-[#e2d8c4] hover:-translate-y-0.5 hover:ring-gold-400"}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${on ? "bg-gold-400 text-brand-900" : "bg-gold-50 text-gold-700 ring-1 ring-gold-200"}`}>{m.fullName.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{m.fullName}</span>
                  <span className={`block text-xs ${on ? "text-gold-200" : "text-slate-500"}`}>{m.relation === "Self" ? (staff ? "Employee (card holder)" : "Myself (card holder)") : m.relation}</span>
                </span>
                {on && <span className="animate-pop ml-auto text-gold-300">✓</span>}
              </button>
            );
          })}
        </div>
        <Link href={familyHref} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gold-700 hover:underline">+ Add a family member</Link>
      </fieldset>

      <fieldset className="card card-pad space-y-4">
        <div>
          <label className="label" htmlFor="letterNo">Referral letter number *</label>
          <input id="letterNo" className="input py-2.5 text-base uppercase" value={letterNo} onChange={(e) => setLetterNo(e.target.value)} placeholder="As printed on the referral letter" autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="dept">Department *</label>
          <select id="dept" className="input py-2.5 text-base" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">Choose the department…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <span className="label">Photo of the referral letter <span className="font-normal text-slate-400">(optional, helps faster verification)</span></span>
          {hasLetter && !file && <p className="mb-2 text-xs text-brand-700">✓ A letter is already attached.</p>}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gold-300 bg-gold-50/40 px-4 py-3 text-sm transition hover:bg-gold-50">
            <Icon name="folder" size={18} className="text-gold-600" />
            <span className="min-w-0 flex-1 truncate">{file ? file.name : hasLetter ? "Add another photo or PDF" : "Choose a photo or PDF"}</span>
            {file && <button type="button" className="text-xs text-red-700" onClick={(e) => { e.preventDefault(); setFile(null); }}>Remove</button>}
            <input type="file" className="hidden" accept="image/jpeg,image/png,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="flex gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <Icon name="building" size={18} className="mt-0.5 shrink-0 text-brand-700" />
          <span>You don&apos;t need to choose a hospital. SUSALI checks the referral, assigns the best available hospital for this department, and tells {staff ? "the employee" : "you"} where to go.</span>
        </div>
      </fieldset>

      {error && <p className="animate-scale-in rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}
      <button className="btn-primary w-full py-3 text-base" disabled={busy}>
        {busy ? "Submitting…" : resubmit ? "Resubmit referral" : "Submit referral"}
      </button>
    </form>
  );
}

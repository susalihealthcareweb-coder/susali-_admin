"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, run } from "./api-client";
import { toast } from "./Toaster";
import { toInputDate } from "@/lib/format";

const EMPTY = {
  familyMemberId: "", dispensaryId: "", dispensaryVisitDate: "", superintendentHospitalId: "", superintendentName: "",
  referralLetterNo: "", referralDate: "", hospitalId: "", departmentId: "", diagnosis: "", urgency: "ROUTINE",
};

// Guided referral form. Saves a Draft on the server and keeps a local copy so
// nothing is lost if the network drops.
export default function ReferralForm({ referral, masters, hasLetter, canSubmit, family = [], holder, employeeId, basePath = "/patient/referrals", familyHref = "/patient/profile#family" }) {
  const router = useRouter();
  const storageKey = `susali-referral-${referral?.id || "new"}`;
  const initial = useMemo(() => {
    if (!referral) return EMPTY;
    return Object.fromEntries(Object.keys(EMPTY).map((k) => [k, k.endsWith("Date") ? toInputDate(referral[k]) : referral[k] || EMPTY[k]]));
  }, [referral]);
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
      const saved = stored && { ...initial, ...stored };
      if (saved && Object.keys(initial).some((k) => (saved[k] || "") !== (initial[k] || ""))) {
        // Restoring an offline copy from localStorage can only happen after mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setV(saved);
        setRestored(true);
      }
    } catch {}
  }, [storageKey, initial]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    try { localStorage.setItem(storageKey, JSON.stringify(v)); } catch {}
  }, [v, storageKey]);

  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const hospital = masters.hospitals.find((h) => h.id === v.hospitalId);
  const depts = hospital?.departmentIds?.length ? masters.departments.filter((d) => hospital.departmentIds.includes(d.id)) : masters.departments;

  const payload = () => ({
    ...v,
    familyMemberId: v.familyMemberId || null,
    dispensaryVisitDate: v.dispensaryVisitDate || null,
    referralDate: v.referralDate || null,
  });

  const save = async () => {
    if (!navigator.onLine) {
      toast("You are offline. Your draft is saved on this phone; save again when you are back online.", "error");
      return null;
    }
    const res = referral
      ? await api(`/api/referrals/${referral.id}`, { method: "PATCH", data: payload() })
      : await api("/api/referrals", { method: "POST", data: { ...payload(), ...(employeeId ? { employeeId } : {}) } });
    try { localStorage.removeItem(storageKey); } catch {}
    return res.referral;
  };

  const onSave = async (e) => {
    e?.preventDefault();
    setBusy(true);
    const r = await run(save, referral ? "Draft saved" : "Draft saved. Now upload your referral letter.");
    setBusy(false);
    if (r && !referral) router.replace(`${basePath}/${r.id}`);
    else if (r) router.refresh();
  };

  const onSubmit = async () => {
    setBusy(true);
    const ok = await run(async () => {
      await save();
      return api(`/api/referrals/${referral.id}/submit`, { method: "POST", data: {} });
    }, "Referral submitted. We will verify it shortly.");
    setBusy(false);
    if (ok) {
      try { localStorage.removeItem(storageKey); } catch {}
      router.refresh();
    }
  };

  return (
    <form onSubmit={onSave} className="space-y-4">
      {restored && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Restored unsaved changes from this device.</p>}
      <fieldset className="card card-pad">
        <h3 className="font-display text-lg font-bold text-brand-900">Who is this referral for?</h3>
        <p className="mb-3 text-xs text-slate-500">{employeeId || holder?.staff ? "The employee or a family member on their card." : "Choose yourself or a family member on your card."}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[{ id: "", fullName: holder?.name || "Myself", relation: "Self" }, ...family].map((m) => {
            const on = (v.familyMemberId || "") === m.id;
            return (
              <button key={m.id || "self"} type="button" onClick={() => setV({ ...v, familyMemberId: m.id })} className={`flex items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 active:scale-[0.98] ${on ? "bg-gradient-to-br from-brand-700 to-brand-900 text-white shadow-md ring-2 ring-gold-400" : "bg-white ring-1 ring-[#e2d8c4] hover:-translate-y-0.5 hover:ring-gold-400"}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${on ? "bg-gold-400 text-brand-900" : "bg-gold-50 text-gold-700 ring-1 ring-gold-200"}`}>{m.fullName.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{m.fullName}</span>
                  <span className={`block text-xs ${on ? "text-gold-200" : "text-slate-500"}`}>{m.relation === "Self" ? (employeeId || holder?.staff ? "Employee (card holder)" : "Myself (card holder)") : m.relation}</span>
                </span>
                {on && <span className="animate-pop ml-auto text-gold-300">✓</span>}
              </button>
            );
          })}
        </div>
        <Link href={familyHref} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gold-700 hover:underline">+ Add a family member</Link>
      </fieldset>

      <fieldset className="card card-pad space-y-3">
        <legend className="sr-only">Dispensary</legend>
        <h3 className="text-sm font-semibold">1. Dispensary visit</h3>
        <div><label className="label">Dispensary visited</label>
          <select className="input" value={v.dispensaryId} onChange={set("dispensaryId")}><option value="">Choose…</option>{masters.dispensaries.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div><label className="label">Visit date</label><input type="date" className="input" max={toInputDate(new Date())} value={v.dispensaryVisitDate} onChange={set("dispensaryVisitDate")} /></div>
      </fieldset>

      <fieldset className="card card-pad space-y-3">
        <h3 className="text-sm font-semibold">2. Referral letter from the superintendent hospital</h3>
        <div><label className="label">Superintendent hospital</label>
          <select className="input" value={v.superintendentHospitalId} onChange={set("superintendentHospitalId")}><option value="">Choose…</option>{masters.superintendents.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div><label className="label">Superintendent or doctor name</label><input className="input" value={v.superintendentName} onChange={set("superintendentName")} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Letter number</label><input className="input" value={v.referralLetterNo} onChange={set("referralLetterNo")} /></div>
          <div><label className="label">Referral date</label><input type="date" className="input" max={toInputDate(new Date())} value={v.referralDate} onChange={set("referralDate")} /></div>
        </div>
      </fieldset>

      <fieldset className="card card-pad space-y-3">
        <h3 className="text-sm font-semibold">3. Where you are referred</h3>
        <div><label className="label">Hospital</label>
          <select className="input" value={v.hospitalId} onChange={(e) => setV({ ...v, hospitalId: e.target.value, departmentId: "" })}><option value="">Choose…</option>{masters.hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}, {h.city}</option>)}</select></div>
        <div><label className="label">Department or speciality</label>
          <select className="input" value={v.departmentId} onChange={set("departmentId")}><option value="">Choose…</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div><label className="label">Diagnosis or reason for referral</label><textarea className="input" rows={3} maxLength={2000} value={v.diagnosis} onChange={set("diagnosis")} placeholder="As written on the referral letter" /></div>
        <div>
          <span className="label">Urgency</span>
          <div className="grid grid-cols-3 gap-2">
            {[["ROUTINE", "Routine"], ["URGENT", "Urgent"], ["EMERGENCY", "Emergency"]].map(([k, l]) => (
              <label key={k} className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm ${v.urgency === k ? "border-brand-600 bg-brand-50 font-medium text-brand-800" : "border-slate-300"}`}>
                <input type="radio" className="sr-only" checked={v.urgency === k} onChange={() => setV({ ...v, urgency: k })} />{l}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={busy}>{referral ? "Save draft" : "Save and continue"}</button>
        {canSubmit && (
          <button type="button" className="btn-primary flex-1" disabled={busy || !hasLetter} onClick={onSubmit}>
            {referral?.status === "INFO_REQUESTED" ? "Resubmit referral" : "Review done — submit referral"}
          </button>
        )}
      </div>
      {canSubmit && !hasLetter && <p className="text-xs text-slate-500">Upload the referral letter above before submitting.</p>}
    </form>
  );
}

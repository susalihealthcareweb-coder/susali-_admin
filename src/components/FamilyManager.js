"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "./Dialog";
import Icon from "./Icon";
import { api, run } from "./api-client";
import { RELATIONS, GENDERS, BLOOD_GROUPS } from "@/lib/constants";
import { ageFrom, toInputDate } from "@/lib/format";

const EMPTY = { fullName: "", relation: "Spouse", gender: "Female", dateOfBirth: "", bloodGroup: "", mobile: "" };

// Family members covered by the employee's card.
export default function FamilyManager({ members, apiBase = "/api/patient/family", staff = false, canRemove = true, canEdit = true }) {
  const router = useRouter();
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const v = edit?.v;
  const set = (k, x) => setEdit((cur) => ({ ...cur, v: { ...cur.v, [k]: x } }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const data = { ...v, bloodGroup: v.bloodGroup || null, mobile: v.mobile || null };
    const ok = await run(() => api(edit?.id ? `${apiBase}/${edit?.id}` : apiBase, { method: edit?.id ? "PATCH" : "POST", data }), edit?.id ? "Saved" : `${v.fullName} added to your card`);
    setBusy(false);
    if (ok) { setEdit(null); router.refresh(); }
  };
  const remove = async (m) => {
    if (!confirm(`Remove ${m.fullName} from your card? Their past referrals stay on record.`)) return;
    if (await run(() => api(`${apiBase}/${m.id}`, { method: "DELETE" }), "Removed")) router.refresh();
  };

  return (
    <section id="family" className="card scroll-mt-24 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-[#efe7d6] bg-gradient-to-r from-gold-50 to-white px-4 py-3 sm:px-5">
        <div>
          <h2 className="font-display text-lg font-bold text-brand-900">{staff ? "Family on this card" : "My family"}</h2>
          <p className="text-xs text-slate-500">{staff ? "Referrals can be raised for any of these people." : "People covered by your card. You can raise referrals for them."}</p>
        </div>
        {canEdit && <button className="btn-primary btn-sm" onClick={() => setEdit({ v: EMPTY })}><Icon name="plus" size={14} /> Add</button>}
      </div>
      <div className="p-4 sm:p-5">
        {members.length ? (
          <ul className="stagger grid gap-3 sm:grid-cols-2">
            {members.map((m) => (
              <li key={m.id} className="lift flex items-center gap-3 rounded-xl border border-[#efe7d6] p-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-sm font-semibold text-gold-100 ring-2 ring-gold-200">{m.fullName.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{m.fullName}</div>
                  <div className="text-xs text-slate-500">{m.relation} · {m.gender} · {ageFrom(m.dateOfBirth)} yrs{m.bloodGroup ? ` · ${m.bloodGroup}` : ""}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {canEdit && <button className="btn-ghost btn-sm" onClick={() => setEdit({ id: m.id, v: { ...EMPTY, ...m, dateOfBirth: toInputDate(m.dateOfBirth), bloodGroup: m.bloodGroup || "", mobile: m.mobile || "" } })} aria-label={`Edit ${m.fullName}`}>Edit</button>}
                  {canRemove && <button className="btn-ghost btn-sm text-red-700" onClick={() => remove(m)} aria-label={`Remove ${m.fullName}`}><Icon name="x" size={14} /></button>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-gold-300 bg-gold-50/40 px-4 py-6 text-center text-sm text-slate-600">
            {staff ? "No family members on this card yet." : "No family members yet. Add your spouse, children or parents to raise referrals for them."}
          </div>
        )}
      </div>

      <Dialog open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? "Edit family member" : "Add family member"} footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Back</button><button className="btn-primary" form="f-family" disabled={busy}>{busy ? "Saving…" : "Save"}</button></>}>
        {v && (
          <form id="f-family" onSubmit={save} className="space-y-3">
            <div><label className="label">Full name *</label><input className="input" required value={v.fullName} onChange={(e) => set("fullName", e.target.value)} /></div>
            <div>
              <span className="label">Relation *</span>
              <div className="flex flex-wrap gap-1.5">
                {RELATIONS.map((r) => (
                  <button key={r} type="button" onClick={() => setEdit((cur) => ({ ...cur, v: { ...cur.v, relation: r, gender: ["Son", "Father", "Father-in-law", "Brother"].includes(r) ? "Male" : ["Daughter", "Mother", "Mother-in-law", "Sister"].includes(r) ? "Female" : cur.v.gender } }))} className={`rounded-full px-3 py-1 text-xs font-medium transition-all active:scale-95 ${v.relation === r ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-[#e2d8c4] hover:ring-gold-400"}`}>{r}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Gender *</label><select className="input" value={v.gender} onChange={(e) => set("gender", e.target.value)}>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select></div>
              <div><label className="label">Date of birth *</label><input type="date" className="input" required max={toInputDate(new Date())} value={v.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} /></div>
              <div><label className="label">Blood group</label><select className="input" value={v.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)}><option value="">—</option>{BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}</select></div>
              <div><label className="label">Mobile (optional)</label><input className="input" inputMode="numeric" maxLength={10} value={v.mobile} onChange={(e) => set("mobile", e.target.value.replace(/\D/g, ""))} /></div>
            </div>
          </form>
        )}
      </Dialog>
    </section>
  );
}

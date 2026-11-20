"use client";

// Support must speak to the patient before sending a referral to a hospital:
// call buttons for the patient (if a family member has their own number) and the
// card holder, a required "I spoke to the patient" tick, and an optional note
// that is saved in the referral's timeline.
export default function CallPatient({ contact, checked, onCheck, note, onNote }) {
  if (!contact) return null;
  const numbers = [];
  if (contact.relation !== "Self" && contact.mobile) numbers.push({ who: `${contact.name} (${contact.relation})`, mobile: contact.mobile });
  if (contact.holderMobile) numbers.push({ who: contact.relation === "Self" ? contact.name : `${contact.holderName} (card holder)`, mobile: contact.holderMobile });
  return (
    <fieldset className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Call the patient first</legend>
      <div className="flex flex-wrap gap-2">
        {numbers.map((n) => (
          <a key={n.mobile} href={`tel:+91${n.mobile}`} className="btn-secondary btn-sm">
            <span aria-hidden="true">📞</span> {n.who} · {n.mobile}
          </a>
        ))}
        {!numbers.length && <p className="text-xs text-amber-800">No mobile number on file.</p>}
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-800">
        <input type="checkbox" className="mt-1" required checked={checked} onChange={(e) => onCheck(e.target.checked)} />
        I spoke to the patient and confirmed the referral
      </label>
      <div>
        <label className="label" htmlFor="call-note">Call note (optional, saved in the timeline)</label>
        <textarea id="call-note" className="input" rows={2} maxLength={500} value={note} onChange={(e) => onNote(e.target.value)} placeholder="e.g. Patient will visit tomorrow morning" />
      </div>
    </fieldset>
  );
}

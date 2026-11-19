"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Dialog from "./Dialog";
import Icon from "./Icon";
import { api, run } from "./api-client";
import { REJECT_REASONS } from "@/lib/constants";

// Accept (verify and forward to the requested hospital) or Reject, right
// from a queue card. "Review" opens the full referral to change hospital,
// read the letter or ask for details.
export default function QueueActions({ id, href, disabled, declined }) {
  const router = useRouter();
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [remarks, setRemarks] = useState("");
  const [done, setDone] = useState(null);
  const [options, setOptions] = useState(null);
  const [hospitalId, setHospitalId] = useState("");
  const openAccept = async () => {
    setOpen("accept");
    if (options) return;
    try {
      const r = await api(`/api/referrals/${id}/suggestions`);
      setOptions(r.rows);
      setHospitalId(r.rows.find((x) => x.suggested)?.id || "");
    } catch (e) { setOptions([]); }
  };
  const chosen = options?.find((x) => x.id === hospitalId);

  const act = async (action, data, msg) => {
    setBusy(true);
    const ok = await run(() => api(`/api/referrals/${id}/${action}`, { method: "POST", data }), msg);
    setBusy(false);
    if (ok) {
      setOpen(null);
      setDone(action);
      setTimeout(() => router.refresh(), 450);
    }
  };

  if (done) {
    return <p className="animate-scale-in text-center text-sm font-medium text-brand-700">{done === "forward" ? `✓ Accepted and sent to ${chosen?.name || "the hospital"}` : "✕ Rejected"}</p>;
  }
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <button className="btn-primary btn-sm" disabled={disabled || busy} onClick={openAccept}><Icon name="check" size={14} strokeWidth={2.5} /> Accept</button>
        <button className="btn-secondary btn-sm text-red-700 hover:border-red-300 hover:bg-red-50" disabled={disabled || busy} onClick={() => setOpen("reject")}>Reject</button>
        <Link href={href} className="btn-ghost btn-sm">Review</Link>
      </div>

      <Dialog open={open === "accept"} onClose={() => setOpen(null)} title="Accept and choose the hospital" footer={<><button className="btn-secondary" onClick={() => setOpen(null)}>Back</button><button className="btn-primary" disabled={busy || !hospitalId} onClick={() => act("forward", { hospitalId, notes }, "Referral accepted and sent")}>{busy ? "Sending…" : "Accept & send"}</button></>}>
        {declined && <p className="mb-3 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800">The previous hospital declined. It is listed last.</p>}
        <label className="label">Hospital</label>
        {options === null ? <p className="text-sm text-slate-500">Finding the best hospital…</p> : (
          <select className="input" value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}>
            <option value="">Choose…</option>
            {options.map((x) => <option key={x.id} value={x.id}>{x.suggested ? "★ Suggested · " : ""}{x.name}, {x.city}{x.offersDepartment ? "" : " (department not listed)"}{x.declinedBefore ? " (declined)" : ""} · {x.openReferrals} open</option>)}
          </select>
        )}
        {chosen?.suggested && <p className="mt-1 text-xs text-brand-700">★ Offers this department{chosen.sameCity ? ", same city as the company" : ""}, {chosen.openReferrals} open referrals.</p>}
        <label className="label mt-4">Notes for the hospital (optional)</label>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        <p className="mt-2 text-xs text-slate-500">The hospital, patient and Cluster Manager are notified. Use Review to see the letter first.</p>
      </Dialog>

      <Dialog open={open === "reject"} onClose={() => setOpen(null)} title="Reject this referral?" footer={<><button className="btn-secondary" onClick={() => setOpen(null)}>Back</button><button className="btn-danger" disabled={busy || remarks.trim().length < 3} onClick={() => act("reject", { reason, remarks }, "Referral rejected")}>Reject</button></>}>
        <label className="label">Reason</label>
        <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>{REJECT_REASONS.map((x) => <option key={x}>{x}</option>)}</select>
        <label className="label mt-3">Remarks (shared with the patient)</label>
        <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="For example: the letter number does not match" />
      </Dialog>
    </>
  );
}

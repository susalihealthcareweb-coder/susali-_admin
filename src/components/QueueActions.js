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
export default function QueueActions({ id, href, hospitalName, disabled, declined }) {
  const router = useRouter();
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [remarks, setRemarks] = useState("");
  const [done, setDone] = useState(null);

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
    return <p className="animate-scale-in text-center text-sm font-medium text-brand-700">{done === "forward" ? `✓ Accepted and sent to ${hospitalName}` : "✕ Rejected"}</p>;
  }
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {declined ? (
          <Link href={href} className="btn-primary btn-sm whitespace-nowrap">Choose hospital</Link>
        ) : (
          <button className="btn-primary btn-sm" disabled={disabled || busy || !hospitalName} onClick={() => setOpen("accept")}><Icon name="check" size={14} strokeWidth={2.5} /> Accept</button>
        )}
        <button className="btn-secondary btn-sm text-red-700 hover:border-red-300 hover:bg-red-50" disabled={disabled || busy} onClick={() => setOpen("reject")}>Reject</button>
        <Link href={href} className="btn-ghost btn-sm">Review</Link>
      </div>

      <Dialog open={open === "accept"} onClose={() => setOpen(null)} title="Accept this referral?" footer={<><button className="btn-secondary" onClick={() => setOpen(null)}>Back</button><button className="btn-primary" disabled={busy} onClick={() => act("forward", { notes }, "Referral accepted and forwarded")}>{busy ? "Sending…" : `Accept & send to hospital`}</button></>}>
        <p className="text-sm text-slate-600">It will be verified and forwarded to <b>{hospitalName}</b>. The hospital, patient and Cluster Manager are notified.</p>
        <label className="label mt-4">Notes for the hospital (optional)</label>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        <p className="mt-2 text-xs text-slate-500">To send it to a different hospital, use Review instead.</p>
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

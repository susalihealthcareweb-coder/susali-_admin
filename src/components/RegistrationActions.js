"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "./Dialog";
import Icon from "./Icon";
import { api, run } from "./api-client";

export default function RegistrationActions({ id, name, compact }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [gone, setGone] = useState(false);
  const decide = async (decision) => {
    setBusy(true);
    const ok = await run(() => api(`/api/employees/${id}/approval`, { method: "POST", data: { decision, note: note || undefined } }), decision === "APPROVE" ? `${name} approved` : `${name} rejected`);
    setBusy(false);
    if (ok) {
      setRejecting(false);
      setGone(true);
      setTimeout(() => router.refresh(), 350);
    }
  };
  return (
    <div className={`flex gap-2 transition-all duration-300 ${gone ? "scale-95 opacity-0" : ""} ${compact ? "" : "w-full sm:w-auto"}`}>
      <button className={`btn-primary ${compact ? "btn-sm" : "flex-1 sm:flex-none"}`} disabled={busy} onClick={() => decide("APPROVE")}><Icon name="check" size={15} strokeWidth={2.5} /> Approve</button>
      <button className={`btn-secondary text-red-700 ${compact ? "btn-sm" : "flex-1 sm:flex-none"}`} disabled={busy} onClick={() => setRejecting(true)}>Reject</button>
      <Dialog open={rejecting} onClose={() => setRejecting(false)} title={`Reject ${name}?`} footer={<><button className="btn-secondary" onClick={() => setRejecting(false)}>Back</button><button className="btn-danger" disabled={busy || note.trim().length < 3} onClick={() => decide("REJECT")}>Reject registration</button></>}>
        <label className="label">Reason (shared with the employee)</label>
        <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: not an employee of this company" />
      </Dialog>
    </div>
  );
}

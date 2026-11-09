"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "./Dialog";
import { api, run } from "./api-client";

// Permanent delete, Super Admin only. The server refuses when the record is
// still referenced, and suggests deactivating instead.
export default function DeleteButton({ url, what, back, small }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const go = async () => {
    setBusy(true);
    const ok = await run(() => api(url, { method: "DELETE" }), `${what} deleted`);
    setBusy(false);
    if (ok) {
      setOpen(false);
      if (back) router.push(back);
      else router.refresh();
    }
  };
  return (
    <>
      <button className={`btn-ghost text-red-700 hover:bg-red-50 ${small ? "btn-sm" : ""}`} onClick={() => { setTyped(""); setOpen(true); }}>Delete</button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Delete ${what}?`} footer={<><button className="btn-secondary" onClick={() => setOpen(false)}>Back</button><button className="btn-danger" disabled={busy || typed !== "DELETE"} onClick={go}>{busy ? "Deleting…" : "Delete permanently"}</button></>}>
        <p className="text-sm text-slate-600">This permanently removes <b>{what}</b> and cannot be undone. Records that are already used by referrals or other data cannot be deleted. Deactivate them instead.</p>
        <label className="label mt-4">Type DELETE to confirm</label>
        <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </Dialog>
    </>
  );
}

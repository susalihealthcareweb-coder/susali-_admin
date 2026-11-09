"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "./Dialog";
import { api, run } from "./api-client";

// Super Admin: anonymise a person who asked for deletion but has records that must be kept.
export default function EraseButton({ url, what, small }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const go = async () => {
    setBusy(true);
    const ok = await run(() => api(url, { method: "POST", data: {} }), "Personal data erased");
    setBusy(false);
    if (ok) { setOpen(false); router.refresh(); }
  };
  return (
    <>
      <button className={`btn-ghost text-red-700 hover:bg-red-50 ${small ? "btn-sm" : ""}`} onClick={() => { setTyped(""); setOpen(true); }}>Erase personal data</button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Erase ${what}'s personal data?`} footer={<><button className="btn-secondary" onClick={() => setOpen(false)}>Back</button><button className="btn-danger" disabled={busy || typed !== "ERASE"} onClick={go}>{busy ? "Erasing…" : "Erase permanently"}</button></>}>
        <p className="text-sm text-slate-600">Removes name, mobile, email, address and family details and deactivates the account. Referral and treatment history stays for record-keeping but is no longer linked to this person. This cannot be undone.</p>
        <label className="label mt-4">Type ERASE to confirm</label>
        <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </Dialog>
    </>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, run } from "./api-client";

// DPDP Act 2023 consent, shown once at first login.
export default function Consent() {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="card card-pad space-y-4">
      <h1 className="text-lg font-semibold">Before you continue</h1>
      <div className="space-y-2 text-sm text-slate-600">
        <p>SUSALI uses your employee details, referral letters and medical reports only to manage your hospital referral.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your referral is checked by the SUSALI verification team and shared with the hospital it is forwarded to.</li>
          <li>Your Cluster Manager can see the status of your referral, but not your medical documents.</li>
          <li>Every view of your documents is recorded.</li>
          <li>You can ask for your data to be deleted by contacting your Cluster Manager or SUSALI support.</li>
        </ul>
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I agree to SUSALI processing my personal and health data for this purpose, under the Digital Personal Data Protection Act, 2023.</label>
      <button className="btn-primary w-full" disabled={!agree || busy} onClick={async () => { setBusy(true); if (await run(() => api("/api/patient/consent", { method: "POST" }))) router.refresh(); setBusy(false); }}>Continue</button>
    </div>
  );
}

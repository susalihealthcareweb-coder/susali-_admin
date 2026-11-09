"use client";
import { useRouter } from "next/navigation";
import { api, run } from "./api-client";

export default function PatientCancel({ id, draft, back = "/patient/referrals" }) {
  const router = useRouter();
  return (
    <button className="btn-ghost w-full text-red-700" onClick={async () => {
      const reason = draft ? "Draft discarded" : prompt("Why are you cancelling this referral?");
      if (reason === null) return;
      if (!draft || confirm("Discard this draft?")) {
        if (await run(() => api(`/api/referrals/${id}/cancel`, { method: "POST", data: { reason: reason || "Cancelled by patient" } }), draft ? "Draft discarded" : "Referral cancelled")) router.push(back);
      }
    }}>{draft ? "Discard draft" : "Cancel referral"}</button>
  );
}

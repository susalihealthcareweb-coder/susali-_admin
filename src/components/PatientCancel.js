"use client";
import { ask } from "./Confirm";
import { useRouter } from "next/navigation";
import { api, run } from "./api-client";

export default function PatientCancel({ id, draft, back = "/patient/referrals" }) {
  const router = useRouter();
  return (
    <button className="btn-ghost w-full text-red-700" onClick={async () => {
      const answer = draft
        ? await ask({ title: "Discard this draft?", confirmLabel: "Discard", danger: true })
        : await ask({ title: "Cancel this referral?", message: "The SUSALI team will be told.", input: "Why are you cancelling? (optional)", confirmLabel: "Cancel referral", cancelLabel: "Keep it", danger: true });
      if (answer === false) return;
      const reason = draft ? "Draft discarded" : answer;
      {
        if (await run(() => api(`/api/referrals/${id}/cancel`, { method: "POST", data: { reason: reason || "Cancelled by patient" } }), draft ? "Draft discarded" : "Referral cancelled")) router.push(back);
      }
    }}>{draft ? "Discard draft" : "Cancel referral"}</button>
  );
}

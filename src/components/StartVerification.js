"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, run } from "./api-client";

export default function StartVerification({ id, href, full }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={`btn-primary whitespace-nowrap ${full ? "w-full" : "btn-sm"}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const ok = await run(() => api(`/api/referrals/${id}/lock`, { method: "POST" }));
        setBusy(false);
        if (ok) router.push(href);
        else router.refresh();
      }}
    >
      {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      Start verification
    </button>
  );
}

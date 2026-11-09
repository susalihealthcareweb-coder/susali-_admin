"use client";
import { useRouter } from "next/navigation";
import { api, run } from "./api-client";

export default function RetryButton({ id }) {
  const router = useRouter();
  return <button className="btn-secondary btn-sm" onClick={async () => { if (await run(() => api(`/api/notifications/${id}/retry`, { method: "POST" }), "Queued for retry")) router.refresh(); }}>Retry</button>;
}

"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, run } from "./api-client";
import { fmtDateTime } from "@/lib/format";

export default function NotificationFeed({ rows, linkBase }) {
  const router = useRouter();
  const read = async (n) => {
    if (!n.isRead) await api(`/api/notifications/${n.id}/read`, { method: "PATCH" }).catch(() => {});
  };
  const readAll = async () => {
    if (await run(() => api("/api/notifications/read-all", { method: "PATCH" }), "All marked as read")) router.refresh();
  };
  if (!rows.length) return <div className="card card-pad text-sm text-slate-500">No alerts yet.</div>;
  return (
    <div>
      <div className="mb-2 flex justify-end"><button className="btn-ghost btn-sm" onClick={readAll}>Mark all as read</button></div>
      <ul className="card divide-y divide-slate-100">
        {rows.map((n) => {
          const inner = (
            <div className={`flex gap-3 px-4 py-3 ${n.isRead ? "" : "bg-brand-50/50"}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-transparent" : "bg-brand-600"}`} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900">{n.title}</div>
                <div className="text-sm text-slate-600">{n.body}</div>
                <div className="mt-0.5 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</div>
              </div>
            </div>
          );
          return (
            <li key={n.id}>
              {n.referralId ? <Link href={`${linkBase}/referrals/${n.referralId}`} onClick={() => read(n)}>{inner}</Link> : <button className="w-full text-left" onClick={() => read(n).then(() => router.refresh())}>{inner}</button>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

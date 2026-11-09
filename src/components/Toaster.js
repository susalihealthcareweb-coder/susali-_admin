"use client";
import { useEffect, useState } from "react";

// Tiny toast system: call toast("Saved") or toast("Failed", "error") anywhere on the client.
export function toast(message, kind = "success") {
  window.dispatchEvent(new CustomEvent("susali-toast", { detail: { message, kind, id: Math.random() } }));
}

export default function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const on = (e) => {
      setItems((x) => [...x, e.detail]);
      setTimeout(() => setItems((x) => x.filter((t) => t.id !== e.detail.id)), 4500);
    };
    window.addEventListener("susali-toast", on);
    return () => window.removeEventListener("susali-toast", on);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} style={{ animation: "toast-in 0.3s cubic-bezier(0.2,0.8,0.2,1) both" }} className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-xl ${t.kind === "error" ? "bg-red-600" : "bg-slate-900"}`}>
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20 text-xs">{t.kind === "error" ? "!" : "✓"}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

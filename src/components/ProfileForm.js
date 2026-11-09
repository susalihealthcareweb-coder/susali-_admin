"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, run } from "./api-client";

export default function ProfileForm({ initial }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  return (
    <form className="card card-pad space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      if (await run(() => api("/api/patient/profile", { method: "PATCH", data: v }), "Profile saved")) router.refresh();
      setBusy(false);
    }}>
      <h2 className="text-sm font-semibold">Contact details you can change</h2>
      <div><label className="label">Email</label><input className="input" type="email" value={v.email} onChange={set("email")} /></div>
      <div><label className="label">Address</label><textarea className="input" rows={2} value={v.address} onChange={set("address")} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Emergency contact</label><input className="input" value={v.emergencyName} onChange={set("emergencyName")} /></div>
        <div><label className="label">Emergency mobile</label><input className="input" inputMode="numeric" value={v.emergencyMobile} onChange={set("emergencyMobile")} /></div>
      </div>
      <button className="btn-primary" disabled={busy}>Save</button>
    </form>
  );
}

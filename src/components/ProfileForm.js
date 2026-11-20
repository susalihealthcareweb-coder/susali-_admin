"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, run } from "./api-client";

export default function ProfileForm({ initial }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { const val = e.target.value; setV((x) => ({ ...x, [k]: val })); };
  return (
    <form className="card card-pad space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      if (await run(() => api("/api/patient/profile", { method: "PATCH", data: v }), "Profile saved")) router.refresh();
      setBusy(false);
    }}>
      <h2 className="text-sm font-semibold">Contact details you can change</h2>
      <div><label className="block"><span className="label">Email</span><input className="input" type="email" value={v.email} onChange={set("email")} /></label></div>
      <div><label className="block"><span className="label">Address</span><textarea className="input" rows={2} value={v.address} onChange={set("address")} /></label></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block"><span className="label">Emergency contact</span><input className="input" value={v.emergencyName} onChange={set("emergencyName")} /></label></div>
        <div><label className="block"><span className="label">Emergency mobile</span><input className="input" inputMode="numeric" value={v.emergencyMobile} onChange={set("emergencyMobile")} /></label></div>
      </div>
      <button className="btn-primary" disabled={busy}>Save</button>
    </form>
  );
}

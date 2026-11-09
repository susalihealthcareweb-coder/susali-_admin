"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, run, uploadFile } from "./api-client";
import { toast } from "./Toaster";

const FIELDS = [
  ["name", "Company name", true], ["industry", "Industry"], ["address", "Address", true, "full"], ["city", "City", true], ["district", "District"],
  ["state", "State", true], ["pincode", "PIN code", true], ["gstNumber", "GST number"], ["hrName", "HR contact name"], ["hrMobile", "HR mobile"], ["hrEmail", "HR email"],
];

// Add (with first visit) or edit a company.
export default function CompanyForm({ company, dispensaries, clusters, canChooseCluster, base }) {
  const router = useRouter();
  const editing = Boolean(company);
  const [v, setV] = useState(() => ({
    ...Object.fromEntries(FIELDS.map(([k]) => [k, company?.[k] || ""])),
    dispensaryId: company?.dispensaryId || "",
    clusterId: company?.clusterId || clusters[0]?.id || "",
  }));
  const [visit, setVisit] = useState({ visitedAt: new Date().toISOString().slice(0, 16), remarks: "", latitude: null, longitude: null });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const data = { ...v };
    if (!editing) data.visit = { ...visit, visitedAt: new Date(visit.visitedAt).toISOString() };
    const res = await run(() => api(editing ? `/api/companies/${company.id}` : "/api/companies", { method: editing ? "PATCH" : "POST", data }), editing ? "Company saved" : "Company added");
    setBusy(false);
    if (res) router.push(`${base}/companies/${res.company.id}`);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="card card-pad">
        <h2 className="mb-3 text-sm font-semibold">Company details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(([k, label, req, full]) => (
            <div key={k} className={full ? "sm:col-span-2" : ""}>
              <label className="label">{label}{req ? " *" : ""}</label>
              <input className="input" value={v[k]} onChange={set(k)} required={req} inputMode={["pincode", "hrMobile"].includes(k) ? "numeric" : undefined} />
            </div>
          ))}
          <div>
            <label className="label">Linked dispensary</label>
            <select className="input" value={v.dispensaryId} onChange={set("dispensaryId")}>
              <option value="">None</option>
              {dispensaries.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {(canChooseCluster || clusters.length > 1) && (
            <div>
              <label className="label">Cluster *</label>
              <select className="input" value={v.clusterId} onChange={set("clusterId")} required>
                {clusters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </section>
      {!editing && <VisitFields visit={visit} setVisit={setVisit} />}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Save company"}</button>
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
      </div>
    </form>
  );
}

export function VisitFields({ visit, setVisit, companyId, showPhoto }) {
  const [locating, setLocating] = useState(false);
  const locate = () => {
    if (!navigator.geolocation) return toast("This device cannot share location.", "error");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setVisit((x) => ({ ...x, latitude: p.coords.latitude, longitude: p.coords.longitude })); setLocating(false); },
      () => { toast("Could not get location. Allow location access and try again.", "error"); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };
  const onPhoto = async (file) => {
    if (!file) return;
    try {
      const key = await uploadFile(file, { purpose: "visit-photo", companyId });
      setVisit((x) => ({ ...x, photoKey: key }));
      toast("Photo attached");
    } catch (e) { toast(e.message, "error"); }
  };
  return (
    <section className="card card-pad">
      <h2 className="mb-3 text-sm font-semibold">Visit</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Visit date and time</label><input type="datetime-local" className="input" value={visit.visitedAt} onChange={(e) => setVisit({ ...visit, visitedAt: e.target.value })} required /></div>
        <div>
          <label className="label">GPS location</label>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary" onClick={locate} disabled={locating}>{locating ? "Locating…" : visit.latitude ? "Update location" : "Capture location"}</button>
            {visit.latitude != null && <span className="text-xs text-slate-600">{visit.latitude.toFixed(5)}, {visit.longitude.toFixed(5)}</span>}
          </div>
        </div>
        {showPhoto && (
          <div>
            <label className="label">Photo of premises (optional)</label>
            <input type="file" accept="image/jpeg,image/png" capture="environment" className="text-sm" onChange={(e) => onPhoto(e.target.files[0])} />
            {visit.photoKey && <p className="mt-1 text-xs text-green-700">Photo attached</p>}
          </div>
        )}
        <div className="sm:col-span-2"><label className="label">Remarks</label><textarea className="input" rows={2} value={visit.remarks} onChange={(e) => setVisit({ ...visit, remarks: e.target.value })} /></div>
      </div>
    </section>
  );
}

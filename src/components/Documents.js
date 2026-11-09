"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, run, uploadFile } from "./api-client";
import { toast } from "./Toaster";
import { DOC_CATEGORIES } from "@/lib/constants";
import { fmtBytes, fmtDateTime } from "@/lib/format";

// Lists documents grouped by category; files open through a 10-minute link.
export function DocumentList({ documents, deletable, group = true }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  if (!documents?.length) return <p className="text-sm text-slate-500">No documents yet.</p>;
  const open = async (d, download) => {
    setBusy(d.id);
    const r = await run(() => api(`/api/documents/${d.id}/url${download ? "?download=1" : ""}`));
    setBusy(null);
    if (!r) return;
    if (download) {
      const a = document.createElement("a");
      a.href = r.url;
      a.download = d.fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else window.open(r.url, "_blank", "noopener");
  };
  const remove = async (d) => {
    if (!confirm(`Remove ${d.fileName}?`)) return;
    if (await run(() => api(`/api/documents/${d.id}`, { method: "DELETE" }), "File removed")) router.refresh();
  };
  const groups = group
    ? Object.entries(documents.reduce((acc, d) => ((acc[d.category] ||= []).push(d), acc), {}))
    : [["", documents]];
  return (
    <div className="space-y-4">
      {groups.map(([cat, docs]) => (
        <div key={cat}>
          {cat && <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{DOC_CATEGORIES[cat]}</div>}
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-slate-100 text-[10px] font-bold uppercase text-slate-500">{d.mimeType.includes("pdf") ? "PDF" : d.mimeType.includes("zip") ? "ZIP" : "IMG"}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-800">{d.fileName}</div>
                  <div className="text-xs text-slate-500">{fmtBytes(d.sizeBytes)} · {fmtDateTime(d.createdAt)}{d.uploadedBy?.name ? ` · ${d.uploadedBy.name}` : d.uploadedByPatient ? " · Patient" : ""}</div>
                </div>
                <div className="flex gap-1">
                  <button className="btn-ghost btn-sm" disabled={busy === d.id} onClick={() => open(d)}>View</button>
                  <button className="btn-ghost btn-sm" disabled={busy === d.id} onClick={() => open(d, true)}>Download</button>
                  {deletable && <button className="btn-ghost btn-sm text-red-600" onClick={() => remove(d)}>Remove</button>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Uploads one or more files to a referral under a chosen category.
export function Uploader({ referralId, categories, maxMb = 20, onDone, compact }) {
  const router = useRouter();
  const [category, setCategory] = useState(categories[0]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const onFiles = async (files) => {
    if (!files?.length) return;
    setBusy(true);
    let n = 0;
    try {
      for (const file of files) {
        if (file.size > maxMb * 1024 * 1024) throw new Error(`${file.name} is larger than ${maxMb} MB.`);
        setProgress(`Uploading ${file.name}…`);
        const key = await uploadFile(file, { purpose: "referral", referralId, category });
        await api(`/api/referrals/${referralId}/documents`, { method: "POST", data: { key, category, fileName: file.name, mimeType: file.type || "application/octet-stream", size: file.size } });
        n++;
      }
      toast(n === 1 ? "File uploaded" : `${n} files uploaded`);
    } catch (e) {
      toast(e.message, "error");
    }
    setBusy(false);
    setProgress("");
    onDone?.();
    router.refresh();
  };
  return (
    <div className={`rounded-lg border border-dashed border-slate-300 bg-slate-50 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-end gap-2">
        {categories.length > 1 && (
          <div>
            <label className="label">Category</label>
            <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c} value={c}>{DOC_CATEGORIES[c]}</option>)}
            </select>
          </div>
        )}
        <label className={`btn-secondary cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
          {busy ? "Uploading…" : categories.length === 1 ? `Upload ${DOC_CATEGORIES[categories[0]].toLowerCase()}` : "Choose files"}
          <input type="file" className="hidden" multiple accept=".pdf,.jpg,.jpeg,.png,.zip,application/pdf,image/jpeg,image/png" capture={undefined} onChange={(e) => { onFiles([...e.target.files]); e.target.value = ""; }} />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-500">{progress || `PDF, JPG or PNG${categories.includes("SCAN") ? ", or DICOM as ZIP" : ""}, up to ${maxMb} MB each.`}</p>
    </div>
  );
}

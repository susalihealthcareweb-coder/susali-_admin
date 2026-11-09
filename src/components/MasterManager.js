"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "./Dialog";
import { api, run } from "./api-client";
import { Badge } from "./ui";
import DeleteButton from "./DeleteButton";

// Generic add/edit/deactivate table for master data.
export default function MasterManager({ type, rows, fields, departments, canEdit, canToggle, canDelete }) {
  const router = useRouter();
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const hasActive = type !== "departments";
  const blank = Object.fromEntries(fields.map((f) => [f.key, f.type === "multi" ? [] : ""]));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const data = Object.fromEntries(fields.map((f) => [f.key, editing?.v[f.key]]));
    const ok = await run(() => api(editing?.id ? `/api/admin/${type}/${editing?.id}` : `/api/admin/${type}`, { method: editing?.id ? "PATCH" : "POST", data }), "Saved");
    setBusy(false);
    if (ok) { setEditing(null); router.refresh(); }
  };
  const toggle = async (r) => {
    if (await run(() => api(`/api/admin/${type}/${r.id}`, { method: "PATCH", data: { isActive: !r.isActive } }), r.isActive ? "Deactivated" : "Activated")) router.refresh();
  };
  const deptName = (id) => departments?.find((d) => d.id === id)?.name;

  return (
    <>
      {canEdit && <div className="mb-3 flex justify-end"><button className="btn-primary" onClick={() => setEditing({ v: blank })}>Add</button></div>}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr>{fields.filter((f) => !f.hideInTable).map((f) => <th key={f.key}>{f.label}</th>)}{hasActive && <th>Status</th>}{canEdit && <th></th>}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {fields.filter((f) => !f.hideInTable).map((f) => (
                  <td key={f.key} className={f.key === "name" ? "font-medium" : ""}>
                    {f.type === "multi" ? <span className="text-xs text-slate-600">{(r[f.key] || []).map(deptName).filter(Boolean).join(", ") || "—"}</span> : r[f.key] || "—"}
                  </td>
                ))}
                {hasActive && <td>{r.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}</td>}
                {canEdit && (
                  <td className="whitespace-nowrap text-right">
                    <button className="btn-ghost btn-sm" onClick={() => setEditing({ id: r.id, v: Object.fromEntries(fields.map((f) => [f.key, r[f.key] ?? (f.type === "multi" ? [] : "")])) })}>Edit</button>
                    {hasActive && canToggle && <button className={`btn-ghost btn-sm ${r.isActive ? "text-red-700" : ""}`} onClick={() => toggle(r)}>{r.isActive ? "Deactivate" : "Activate"}</button>}
                    {canDelete && <DeleteButton url={`/api/admin/${type}/${r.id}`} what={r.name} small />}
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="py-8 text-center text-slate-500">Nothing added yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? "Edit" : "Add"} wide footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Back</button><button className="btn-primary" form="f-master" disabled={busy}>Save</button></>}>
        {editing && (
          <form id="f-master" onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className={f.type === "multi" || f.full ? "sm:col-span-2" : ""}>
                <label className="label">{f.label}{f.required ? " *" : ""}</label>
                {f.type === "multi" ? (
                  <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 text-sm">
                    {departments.map((d) => (
                      <label key={d.id} className="flex items-center gap-2">
                        <input type="checkbox" checked={editing.v[f.key].includes(d.id)} onChange={(e) => { const on = e.target.checked; setEditing((cur) => ({ ...cur, v: { ...cur.v, [f.key]: on ? [...cur.v[f.key], d.id] : cur.v[f.key].filter((x) => x !== d.id) } })); }} />
                        {d.name}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input className="input" type={f.type || "text"} required={f.required} value={editing.v[f.key]} onChange={(e) => { const val = e.target.value; setEditing((cur) => ({ ...cur, v: { ...cur.v, [f.key]: val } })); }} />
                )}
              </div>
            ))}
          </form>
        )}
      </Dialog>
    </>
  );
}

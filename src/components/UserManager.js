"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "./Dialog";
import { api, run } from "./api-client";
import { Badge } from "./ui";
import DeleteButton from "./DeleteButton";
import EraseButton from "./EraseButton";
import { ROLES } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";

export default function UserManager({ users, clusters, hospitals, myRole, myId }) {
  const router = useRouter();
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const roles = myRole === "SUPER_ADMIN" ? ["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "CLUSTER_MANAGER", "HOSPITAL_USER"] : ["SUPPORT", "CLUSTER_MANAGER", "HOSPITAL_USER"];
  const blank = { name: "", email: "", mobile: "", role: "SUPPORT", password: "", clusterIds: [], hospitalId: "", isActive: true, muteWhatsapp: false, muteEmail: false };
  const canManage = (u) => myRole === "SUPER_ADMIN" || !["SUPER_ADMIN", "SUDO_ADMIN"].includes(u.role);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const data = { ...edit?.v };
    if (!data.password) delete data.password;
    const ok = await run(() => api(edit?.id ? `/api/admin/users/${edit?.id}` : "/api/admin/users", { method: edit?.id ? "PATCH" : "POST", data }), "User saved");
    setBusy(false);
    if (ok) { setEdit(null); router.refresh(); }
  };
  const v = edit?.v;
  const set = (k, val) => setEdit((cur) => ({ ...cur, v: { ...cur.v, [k]: val } }));
  const hname = (id) => hospitals.find((h) => h.id === id)?.name;
  const cname = (ids) => ids.map((id) => clusters.find((c) => c.id === id)?.name).filter(Boolean).join(", ");
  return (
    <>
      <div className="mb-3 flex justify-end"><button className="btn-primary" onClick={() => setEdit({ v: blank })}>Add user</button></div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Role</th><th>Scope</th><th>Contact</th><th>Alerts</th><th>Last login</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td>{ROLES[u.role].label}</td>
                <td className="text-xs text-slate-600">{u.role === "CLUSTER_MANAGER" ? cname(u.clusterIds) : u.role === "HOSPITAL_USER" ? hname(u.hospitalId) : "All"}</td>
                <td className="text-xs"><div>{u.email}</div><div className="text-slate-500">{u.mobile}</div></td>
                <td className="text-xs text-slate-600">{[u.muteWhatsapp ? "WA off" : "WA", u.muteEmail ? "Email off" : "Email"].join(" · ")}</td>
                <td className="text-xs text-slate-500">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Never"}</td>
                <td>{u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}{u.deletionRequestedAt && <div className="mt-1"><Badge tone="red">Deletion requested</Badge></div>}</td>
                <td className="whitespace-nowrap text-right">{canManage(u) && <button className="btn-ghost btn-sm" onClick={() => setEdit({ id: u.id, v: { ...blank, ...u, hospitalId: u.hospitalId || "", password: "" } })}>Edit</button>}{myRole === "SUPER_ADMIN" && u.id !== myId && <DeleteButton url={`/api/admin/users/${u.id}`} what={u.name} small />}{myRole === "SUPER_ADMIN" && u.deletionRequestedAt && u.name !== "Erased user" && <EraseButton url={`/api/admin/users/${u.id}/erase`} what={u.name} small />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? "Edit user" : "Add user"} wide footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Back</button><button className="btn-primary" form="f-user" disabled={busy}>Save</button></>}>
        {v && (
          <form id="f-user" onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Name *</label><input className="input" required value={v.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div><label className="label">Role *</label><select className="input" value={v.role} disabled={edit?.id === myId} onChange={(e) => set("role", e.target.value)}>{roles.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}</select></div>
            <div><label className="label">Email (login) *</label><input className="input" type="email" required value={v.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div><label className="label">Mobile (WhatsApp) *</label><input className="input" required inputMode="numeric" value={v.mobile} onChange={(e) => set("mobile", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label">{edit?.id ? "New password (leave blank to keep)" : "Initial password *"}</label><input className="input" type="password" autoComplete="new-password" minLength={8} required={!edit?.id} value={v.password} onChange={(e) => set("password", e.target.value)} /></div>
            {v.role === "CLUSTER_MANAGER" && (
              <div className="sm:col-span-2">
                <label className="label">Clusters *</label>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 p-2 text-sm">
                  {clusters.map((c) => <label key={c.id} className="flex items-center gap-2"><input type="checkbox" checked={v.clusterIds.includes(c.id)} onChange={(e) => set("clusterIds", e.target.checked ? [...v.clusterIds, c.id] : v.clusterIds.filter((x) => x !== c.id))} />{c.name}</label>)}
                </div>
              </div>
            )}
            {v.role === "HOSPITAL_USER" && (
              <div className="sm:col-span-2"><label className="label">Hospital *</label><select className="input" required value={v.hospitalId} onChange={(e) => set("hospitalId", e.target.value)}><option value="">Choose…</option>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
            )}
            <div className="flex flex-wrap gap-4 text-sm sm:col-span-2">
              {myRole === "SUPER_ADMIN" && <label className="flex items-center gap-2"><input type="checkbox" checked={v.isActive} disabled={edit?.id === myId} onChange={(e) => set("isActive", e.target.checked)} /> Active</label>}
              {myRole === "SUPER_ADMIN" && <label className="flex items-center gap-2"><input type="checkbox" checked={v.muteWhatsapp} onChange={(e) => set("muteWhatsapp", e.target.checked)} /> Mute WhatsApp</label>}
              {myRole === "SUPER_ADMIN" && <label className="flex items-center gap-2"><input type="checkbox" checked={v.muteEmail} onChange={(e) => set("muteEmail", e.target.checked)} /> Mute email</label>}
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}

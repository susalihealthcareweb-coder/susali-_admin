import { prisma } from "@/lib/prisma";
import { staffPage, qs } from "@/lib/page";
import { auditWhere } from "@/lib/audit-query";
import { PageHeader, Pagination } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Audit log" };

const ACTIONS = ["LOGIN", "LOGIN_FAILED", "CREATE", "UPDATE", "DEACTIVATE", "STATUS_CHANGE", "OVERRIDE", "REOPEN", "REASSIGN", "FILE_UPLOAD", "FILE_VIEW", "FILE_DOWNLOAD", "FILE_DELETE", "BULK_UPLOAD", "REPORT_EXPORT", "SETTINGS_UPDATE", "CONSENT_GIVEN", "AUTO_CLOSE"];

export default async function Audit({ params, searchParams }) {
  const { base } = await staffPage(params, ["SUPER_ADMIN", "SUDO_ADMIN"]);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = auditWhere(sp);
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 }),
    prisma.auditLog.count({ where }),
  ]);
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x) => /^[a-f0-9]{24}$/.test(x || "")))];
  const [users, emps] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }),
    prisma.employee.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true } }),
  ]);
  const names = Object.fromEntries([...users.map((u) => [u.id, u.name]), ...emps.map((e) => [e.id, e.fullName])]);
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every create, update, status change, login and file access." />
      <form method="get" className="card card-pad mb-4 grid gap-3 sm:grid-cols-5">
        <div className="sm:col-span-2"><label className="label">Search (record id, user id, IP)</label><input className="input" name="q" defaultValue={sp.q} /></div>
        <div><label className="label">Action</label><select className="input" name="action" defaultValue={sp.action || ""}><option value="">All</option>{ACTIONS.map((a) => <option key={a}>{a}</option>)}</select></div>
        <div><label className="label">Entity</label><select className="input" name="entity" defaultValue={sp.entity || ""}><option value="">All</option>{["Referral", "Employee", "Company", "User", "Document", "Hospital", "Report", "Setting"].map((a) => <option key={a}>{a}</option>)}</select></div>
        <div className="flex items-end"><button className="btn-primary">Filter</button></div>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Details</th><th>IP</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-xs">{fmtDateTime(r.createdAt)}</td>
                <td className="text-xs"><div className="font-medium">{names[r.actorId] || r.actorId || "—"}</div><div className="text-slate-500">{r.actorRole}</div></td>
                <td className="font-mono text-xs">{r.action}</td>
                <td className="text-xs">{r.entity}<div className="font-mono text-slate-500">{r.entity === "Referral" && r.entityId ? <a className="link" href={`${base}/referrals/${r.entityId}`}>{r.entityId}</a> : r.entityId}</div></td>
                <td className="max-w-md"><code className="line-clamp-3 break-all text-[11px] text-slate-600">{r.after ? JSON.stringify(r.after) : ""}</code></td>
                <td className="text-xs text-slate-500">{r.ipAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / 50))} makeHref={(p) => `${base}/audit${qs(sp, { page: p })}`} />
    </>
  );
}

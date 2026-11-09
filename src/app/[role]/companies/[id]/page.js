import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { staffPage, qs } from "@/lib/page";
import { companyScope } from "@/lib/scope";
import { PageHeader, Section, Field, Badge, Pagination } from "@/components/ui";
import SearchBar from "@/components/SearchBar";
import { LogVisit, CompanyStatusToggle, EmployeeDialog, EmployeeStatusToggle, BulkUpload } from "@/components/CompanyTools";
import { fmtDate, fmtDateTime } from "@/lib/format";
import RegistrationActions from "@/components/RegistrationActions";
import DeleteButton from "@/components/DeleteButton";

export const metadata = { title: "Company" };

export default async function CompanyPage({ params, searchParams }) {
  const { me, base, role } = await staffPage(params, ["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "CLUSTER_MANAGER"]);
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[a-f0-9]{24}$/.test(id)) notFound();
  const c = await prisma.company.findFirst({ where: { AND: [{ id }, companyScope(me)] }, include: { cluster: true, dispensary: true, createdBy: { select: { name: true } } } });
  if (!c) notFound();
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();
  const empWhere = { companyId: id, ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { employeeCode: { contains: q, mode: "insensitive" } }, { mobile: { contains: q } }] } : {}) };
  const [employees, empTotal, visits, refCount] = await Promise.all([
    prisma.employee.findMany({ where: empWhere, orderBy: { createdAt: "desc" }, skip: (page - 1) * 20, take: 20 }),
    prisma.employee.count({ where: empWhere }),
    prisma.companyVisit.findMany({ where: { companyId: id }, orderBy: { visitedAt: "desc" }, take: 10, include: { user: { select: { name: true } } } }),
    prisma.referral.count({ where: { companyId: id, status: { not: "DRAFT" } } }),
  ]);
  const canEdit = ["SUPER_ADMIN", "SUDO_ADMIN", "CLUSTER_MANAGER"].includes(role);
  const isAdmin = ["SUPER_ADMIN", "SUDO_ADMIN"].includes(role);
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: `${base}/companies`, label: "Companies" }}
        title={c.name}
        subtitle={`${c.code} · ${c.cluster.name}`}
        actions={canEdit && (
          <>
            {isAdmin && <Link className="btn-secondary" href={`${base}/companies/${id}/edit`}>Edit</Link>}
            {(role === "CLUSTER_MANAGER" || isAdmin) && <LogVisit companyId={id} />}
            {role === "SUPER_ADMIN" && <CompanyStatusToggle id={id} isActive={c.isActive} />}
            {role === "SUPER_ADMIN" && <DeleteButton url={`/api/companies/${id}`} what={c.name} back={`${base}/companies`} />}
          </>
        )}
      />
      {!c.isActive && <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-800">This company is inactive.</div>}
      <div className="grid gap-5 lg:grid-cols-3">
        <Section title="Details" className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Industry">{c.industry}</Field>
            <Field label="Address">{[c.address, c.city, c.district, c.state, c.pincode].filter(Boolean).join(", ")}</Field>
            <Field label="GST number">{c.gstNumber}</Field>
            <Field label="HR contact">{c.hrName}</Field>
            <Field label="HR mobile">{c.hrMobile}</Field>
            <Field label="HR email">{c.hrEmail}</Field>
            <Field label="Linked dispensary">{c.dispensary?.name}</Field>
            <Field label="Registered by">{c.createdBy?.name} · {fmtDate(c.createdAt)}</Field>
            <Field label="Referrals"><Link className="link" href={`${base}/referrals?q=${encodeURIComponent(c.code)}`}>{refCount}</Link></Field>
          </dl>
        </Section>
        <Section title="Visit log">
          {visits.length ? (
            <ul className="space-y-3">
              {visits.map((v) => (
                <li key={v.id} className="text-sm">
                  <div className="font-medium">{fmtDateTime(v.visitedAt)}</div>
                  <div className="text-xs text-slate-500">
                    {v.user?.name}
                    {v.latitude != null && <> · <a className="link" target="_blank" rel="noopener noreferrer" href={`https://maps.google.com/?q=${v.latitude},${v.longitude}`}>GPS</a></>}
                    {v.photoKey && " · photo"}
                  </div>
                  {v.remarks && <div className="text-slate-600">{v.remarks}</div>}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">No visits logged.</p>}
        </Section>
      </div>

      <Section
        title={`Employees (${empTotal})`}
        actions={canEdit && c.isActive && <div className="flex gap-2"><BulkUpload companyId={id} /><EmployeeDialog companyId={id} /></div>}
      >
        <div className="mb-3"><SearchBar placeholder="Name, employee ID or mobile" /></div>
        {employees.length ? (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="table">
              <thead><tr><th>Employee</th><th>Mobile</th><th>Department</th><th>Last login</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td><Link className="link" href={`${base}/employees/${e.id}`}>{e.fullName}</Link><div className="text-xs text-slate-500">{e.employeeCode} · {e.gender}</div></td>
                    <td className="font-mono text-xs">{e.mobile}</td>
                    <td>{e.department}<div className="text-xs text-slate-500">{e.designation}</div></td>
                    <td className="text-xs text-slate-500">{e.lastLoginAt ? fmtDateTime(e.lastLoginAt) : "Never"}</td>
                    <td>{e.approvalStatus === "PENDING" ? <Badge tone="amber">Awaiting approval</Badge> : e.approvalStatus === "REJECTED" ? <Badge tone="red">Rejected</Badge> : e.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}{e.selfRegistered && <div className="mt-0.5 text-[10px] text-slate-400">Self-registered</div>}</td>
                    {canEdit && (
                      <td className="whitespace-nowrap text-right">
                        {e.approvalStatus === "PENDING" ? <div className="flex justify-end"><RegistrationActions id={e.id} name={e.fullName} compact /></div> : <>
                        <EmployeeDialog companyId={id} employee={JSON.parse(JSON.stringify(e))} trigger={<button className="btn-ghost btn-sm">Edit</button>} />
                        {role !== "SUDO_ADMIN" && <EmployeeStatusToggle id={e.id} isActive={e.isActive} />}
                        </>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-slate-500">No employees{q ? " match" : " yet"}.</p>}
        <Pagination page={page} pages={Math.max(1, Math.ceil(empTotal / 20))} makeHref={(p) => `${base}/companies/${id}${qs(sp, { page: p })}`} />
      </Section>
    </div>
  );
}

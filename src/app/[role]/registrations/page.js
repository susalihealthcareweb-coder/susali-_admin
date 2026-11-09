import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { staffPage } from "@/lib/page";
import { companyScope } from "@/lib/scope";
import { PageHeader, Empty, Badge, Tabs } from "@/components/ui";
import RegistrationActions from "@/components/RegistrationActions";
import { fmtDate, fmtDateTime, ageFrom } from "@/lib/format";

export const metadata = { title: "Approvals" };

// Self-registered employees waiting for a Cluster Manager or admin.
export default async function Registrations({ params, searchParams }) {
  const { me, base } = await staffPage(params, ["SUPER_ADMIN", "SUDO_ADMIN", "CLUSTER_MANAGER"]);
  const sp = await searchParams;
  const tab = ["APPROVED", "REJECTED"].includes(sp.tab) ? sp.tab : "PENDING";
  const companies = await prisma.company.findMany({ where: companyScope(me), select: { id: true, name: true, code: true } });
  const cmap = Object.fromEntries(companies.map((c) => [c.id, c]));
  const where = { companyId: { in: companies.map((c) => c.id) }, selfRegistered: true };
  const [rows, counts] = await Promise.all([
    prisma.employee.findMany({ where: { ...where, approvalStatus: tab }, orderBy: { createdAt: tab === "PENDING" ? "asc" : "desc" }, take: 100 }),
    prisma.employee.groupBy({ by: ["approvalStatus"], where, _count: { _all: true } }),
  ]);
  const count = (s) => counts.find((c) => c.approvalStatus === s)?._count._all || 0;
  return (
    <>
      <PageHeader title="Employee approvals" subtitle="Employees who registered themselves. Check they work at the company before approving." />
      <Tabs active={tab} tabs={[["PENDING", "Waiting"], ["APPROVED", "Approved"], ["REJECTED", "Rejected"]].map(([k, l]) => ({ key: k, label: l, count: count(k), href: `${base}/registrations?tab=${k}` }))} />
      {rows.length ? (
        <div className="stagger grid gap-3 lg:grid-cols-2">
          {rows.map((e) => (
            <div key={e.id} className="card card-pad lift">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 font-semibold text-white">{e.fullName.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{e.fullName}</span>{tab === "PENDING" && <Badge tone="amber">Waiting</Badge>}</div>
                  <div className="text-sm text-slate-600">{e.employeeCode} · <Link className="link" href={`${base}/companies/${e.companyId}`}>{cmap[e.companyId]?.name}</Link></div>
                  <div className="mt-1 text-xs text-slate-500">{e.gender} · {ageFrom(e.dateOfBirth)} yrs (born {fmtDate(e.dateOfBirth)}) · {e.mobile}{e.email ? ` · ${e.email}` : ""}</div>
                  {(e.department || e.designation) && <div className="text-xs text-slate-500">{[e.department, e.designation].filter(Boolean).join(" · ")}</div>}
                  <div className="mt-1 text-xs text-slate-400">Registered {fmtDateTime(e.createdAt)}{e.approvedAt ? ` · reviewed ${fmtDateTime(e.approvedAt)}` : ""}</div>
                  {e.approvalNote && <div className="mt-1 text-xs text-red-700">Reason: {e.approvalNote}</div>}
                </div>
              </div>
              {tab === "PENDING" && <div className="mt-4 flex justify-end border-t border-slate-100 pt-3"><RegistrationActions id={e.id} name={e.fullName} /></div>}
            </div>
          ))}
        </div>
      ) : <Empty title={tab === "PENDING" ? "No one is waiting" : "Nothing here"}>{tab === "PENDING" ? "New self-registrations from your companies will appear here." : null}</Empty>}
    </>
  );
}

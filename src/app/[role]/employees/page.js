import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { staffPage, qs } from "@/lib/page";
import { companyScope } from "@/lib/scope";
import { PageHeader, Pagination, Tabs, Empty, Badge } from "@/components/ui";
import SearchBar from "@/components/SearchBar";
import { EmployeeDialog } from "@/components/CompanyTools";
import RegistrationActions from "@/components/RegistrationActions";
import { fmtDateTime, ageFrom } from "@/lib/format";

export const metadata = { title: "Employees" };

const PER_PAGE = 24;

// All employees across this person's companies: search, filter, add, approve.
export default async function Employees({ params, searchParams }) {
  const { me, base, role } = await staffPage(params, ["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "CLUSTER_MANAGER"]);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const tab = ["ACTIVE", "PENDING", "INACTIVE"].includes(sp.status) ? sp.status : "ALL";
  const companies = await prisma.company.findMany({ where: companyScope(me), select: { id: true, name: true, isActive: true }, orderBy: { name: "asc" } });
  const cname = Object.fromEntries(companies.map((c) => [c.id, c.name]));
  const companyIds = companies.map((c) => c.id).filter((id) => !sp.company || id === sp.company);
  const q = (sp.q || "").trim();
  const rx = { contains: q, mode: "insensitive" };
  const base_ = { companyId: { in: companyIds } };
  // Employees added by a Cluster Manager have no approvalStatus at all, so
  // "not pending" must also match a missing field.
  const notPending = { OR: [{ approvalStatus: { isSet: false } }, { approvalStatus: null }, { approvalStatus: { in: ["APPROVED", "REJECTED"] } }] };
  const ACTIVE_WHERE = { isActive: true, ...notPending };
  const statusWhere = { ACTIVE: ACTIVE_WHERE, PENDING: { approvalStatus: "PENDING" }, INACTIVE: { isActive: false } }[tab] || {};
  const search = q ? { OR: [{ fullName: rx }, { employeeCode: rx }, { mobile: { contains: q.replace(/\D/g, "") || q } }] } : {};
  const where = { AND: [base_, statusWhere, search] };
  const [rows, total, counts] = await Promise.all([
    prisma.employee.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { _count: { select: { familyMembers: { where: { isActive: true } }, referrals: true } } } }),
    prisma.employee.count({ where }),
    Promise.all([
      prisma.employee.count({ where: base_ }),
      prisma.employee.count({ where: { ...base_, ...ACTIVE_WHERE } }),
      prisma.employee.count({ where: { ...base_, approvalStatus: "PENDING" } }),
      prisma.employee.count({ where: { ...base_, isActive: false } }),
    ]),
  ]);
  const canAdd = ["SUPER_ADMIN", "SUDO_ADMIN", "CLUSTER_MANAGER"].includes(role);
  const activeCompanies = companies.filter((c) => c.isActive);
  const tabHref = (k) => `${base}/employees${qs(sp, { status: k === "ALL" ? null : k, page: null })}`;

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={`${counts[0]} employees across ${companies.length} ${companies.length === 1 ? "company" : "companies"}`}
        actions={canAdd && activeCompanies.length > 0 && <EmployeeDialog companies={activeCompanies.map((c) => ({ id: c.id, name: c.name }))} trigger={<button className="btn-primary">+ Add employee</button>} />}
      />
      <Tabs active={tab} tabs={[["ALL", "All", counts[0]], ["ACTIVE", "Active", counts[1]], ["PENDING", "Waiting approval", counts[2]], ["INACTIVE", "Inactive", counts[3]]].map(([k, l, n]) => ({ key: k, label: l, count: n, href: tabHref(k) }))} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBar placeholder="Name, employee ID or mobile" />
        {companies.length > 1 && (
          <form method="get" className="flex gap-2">
            {tab !== "ALL" && <input type="hidden" name="status" value={tab} />}
            {q && <input type="hidden" name="q" value={q} />}
            <select name="company" defaultValue={sp.company || ""} className="input w-auto">
              <option value="">All companies</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn-secondary">Filter</button>
          </form>
        )}
      </div>
      {rows.length ? (
        <div className="stagger grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {rows.map((e) => {
            const pending = e.approvalStatus === "PENDING";
            return (
              <article key={e.id} className="lift card flex flex-col">
                <Link href={`${base}/employees/${e.id}`} className="flex flex-1 gap-3 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-sm font-semibold text-gold-100 ring-2 ring-gold-200">{e.fullName.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-slate-900">{e.fullName}</span>
                      {pending ? <Badge tone="amber">Waiting approval</Badge> : e.isActive ? null : <Badge tone="red">Inactive</Badge>}
                    </div>
                    <div className="truncate text-xs text-slate-500">{e.employeeCode} · {cname[e.companyId]}</div>
                    <div className="mt-1 text-xs text-slate-500">{e.gender} · {ageFrom(e.dateOfBirth)} yrs · {e.mobile}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {e._count.familyMembers > 0 && <Badge tone="teal">+{e._count.familyMembers} family</Badge>}
                      {e._count.referrals > 0 && <Badge tone="gold">{e._count.referrals} referral{e._count.referrals === 1 ? "" : "s"}</Badge>}
                      {e.selfRegistered && <Badge tone="slate">Self-registered</Badge>}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">Last app login: {e.lastLoginAt ? fmtDateTime(e.lastLoginAt) : "never"}</div>
                  </div>
                </Link>
                {pending && canAdd && <div className="border-t border-[#efe7d6] bg-[#fdfbf7] px-4 py-3"><RegistrationActions id={e.id} name={e.fullName} compact /></div>}
              </article>
            );
          })}
        </div>
      ) : <Empty title={q ? "No employee matches" : "No employees here"}>{canAdd && tab === "ALL" ? "Add the first employee with the button above." : null}</Empty>}
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / PER_PAGE))} makeHref={(p) => `${base}/employees${qs(sp, { page: p })}`} />
    </>
  );
}

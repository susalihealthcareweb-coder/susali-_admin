import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { staffPage } from "@/lib/page";
import { patientMasters } from "@/lib/patient-masters";
import { PageHeader, Empty, Badge } from "@/components/ui";
import SearchBar from "@/components/SearchBar";
import ReferralForm from "@/components/ReferralForm";
import Icon from "@/components/Icon";
import { ageFrom } from "@/lib/format";

export const metadata = { title: "New referral" };

// A Cluster Manager raises a referral on behalf of an employee in their
// cluster. Step 1: pick the employee. Step 2: the same form employees use.
export default async function NewReferral({ params, searchParams }) {
  const { me, base } = await staffPage(params, ["CLUSTER_MANAGER"]);
  const sp = await searchParams;
  const companies = await prisma.company.findMany({ where: { clusterId: { in: me.clusterIds }, isActive: true }, select: { id: true, name: true } });
  const companyIds = companies.map((c) => c.id);
  const cname = Object.fromEntries(companies.map((c) => [c.id, c.name]));

  const employeeId = /^[a-f0-9]{24}$/.test(sp.employee || "") ? sp.employee : null;
  const emp = employeeId ? await prisma.employee.findFirst({ where: { id: employeeId, companyId: { in: companyIds } } }) : null;

  if (emp) {
    const [masters, family] = await Promise.all([
      patientMasters(),
      prisma.familyMember.findMany({ where: { employeeId: emp.id, isActive: true }, select: { id: true, fullName: true, relation: true }, orderBy: { createdAt: "asc" } }),
    ]);
    const blocked = !emp.isActive || emp.approvalStatus === "PENDING" || emp.approvalStatus === "REJECTED";
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader back={{ href: `${base}/referrals/new`, label: "Choose another employee" }} title="New referral" subtitle={`On behalf of ${emp.fullName} · ${cname[emp.companyId]}`} />
        <div className="card card-pad flex flex-wrap items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 font-semibold text-gold-100 ring-2 ring-gold-200">{emp.fullName.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{emp.fullName}</div>
            <div className="text-sm text-slate-500">Emp ID {emp.employeeCode} · {ageFrom(emp.dateOfBirth)} yrs · {emp.gender}{emp.bloodGroup ? ` · ${emp.bloodGroup}` : ""} · {emp.mobile}</div>
          </div>
          <Link href={`${base}/employees/${emp.id}`} className="btn-ghost btn-sm">Full profile</Link>
        </div>
        {blocked ? (
          <Empty title="Cannot raise a referral">{emp.approvalStatus === "PENDING" ? "Approve this employee's registration first." : "This employee is not active."}</Empty>
        ) : (
          <>
            <p className="rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-800 ring-1 ring-gold-200">Save the draft first, then upload the referral letter and submit. The employee sees this referral in their SUSALI app too.</p>
            <ReferralForm masters={masters} family={family} holder={{ name: emp.fullName, staff: true }} employeeId={emp.id} basePath={`${base}/referrals`} familyHref={`${base}/employees/${emp.id}#family`} />
          </>
        )}
      </div>
    );
  }

  const q = (sp.q || "").trim();
  const rx = { contains: q, mode: "insensitive" };
  const employees = await prisma.employee.findMany({
    where: {
      companyId: { in: companyIds },
      isActive: true,
      ...(q ? { OR: [{ fullName: rx }, { employeeCode: rx }, { mobile: { contains: q.replace(/\D/g, "") || q } }] } : {}),
    },
    orderBy: q ? { fullName: "asc" } : { updatedAt: "desc" },
    take: 30,
  });
  const familyCounts = await prisma.familyMember.groupBy({ by: ["employeeId"], where: { employeeId: { in: employees.map((e) => e.id) }, isActive: true }, _count: { _all: true } });
  const fc = Object.fromEntries(familyCounts.map((f) => [f.employeeId, f._count._all]));

  return (
    <>
      <PageHeader title="New referral" subtitle="Step 1 of 2 · Choose the employee whose card the referral is on." />
      <div className="mb-4"><SearchBar placeholder="Name, employee ID or mobile" /></div>
      {employees.length ? (
        <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {employees.map((e) => {
            const pending = e.approvalStatus === "PENDING";
            return (
              <Link key={e.id} href={pending ? `${base}/employees/${e.id}` : `${base}/referrals/new?employee=${e.id}`} className="lift card card-pad flex items-center gap-3 hover:border-gold-400">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold-50 text-sm font-semibold text-gold-700 ring-1 ring-gold-200">{e.fullName.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{e.fullName}</div>
                  <div className="truncate text-xs text-slate-500">{e.employeeCode} · {cname[e.companyId]}</div>
                  <div className="mt-1 flex gap-1.5">{fc[e.id] ? <Badge tone="teal">+{fc[e.id]} family</Badge> : null}{pending && <Badge tone="amber">Awaiting approval</Badge>}</div>
                </div>
                <Icon name="arrowRight" size={16} className="text-gold-600" />
              </Link>
            );
          })}
        </div>
      ) : <Empty title={q ? "No employee matches" : "No employees yet"}>Add employees from the company page first.</Empty>}
    </>
  );
}

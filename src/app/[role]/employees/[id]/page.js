import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { staffPage } from "@/lib/page";
import { companyScope } from "@/lib/scope";
import { listReferrals } from "@/lib/referral-queries";
import { PageHeader, Section, Field, Badge, Empty } from "@/components/ui";
import FamilyManager from "@/components/FamilyManager";
import ReferralCard from "@/components/ReferralCard";
import { EmployeeDialog, EmployeeStatusToggle } from "@/components/CompanyTools";
import RegistrationActions from "@/components/RegistrationActions";
import DeleteButton from "@/components/DeleteButton";
import EraseButton from "@/components/EraseButton";
import Icon from "@/components/Icon";
import { fmtDate, fmtDateTime, ageFrom } from "@/lib/format";

export const metadata = { title: "Employee" };

// Everything about one employee: profile, family on the card and referrals.
export default async function EmployeePage({ params }) {
  const { me, base, role } = await staffPage(params, ["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "CLUSTER_MANAGER"]);
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) notFound();
  const e = await prisma.employee.findUnique({ where: { id }, include: { company: { include: { cluster: { select: { name: true } } } } } });
  if (!e) notFound();
  const allowed = await prisma.company.findFirst({ where: { AND: [{ id: e.companyId }, companyScope(me)] }, select: { id: true } });
  if (!allowed) notFound();
  const [family, refs] = await Promise.all([
    prisma.familyMember.findMany({ where: { employeeId: id, isActive: true }, orderBy: { createdAt: "asc" } }),
    listReferrals(me, { extra: { employeeId: id } }, { take: 50 }),
  ]);
  const canEdit = ["SUPER_ADMIN", "SUDO_ADMIN", "CLUSTER_MANAGER"].includes(role);
  const isCm = role === "CLUSTER_MANAGER";
  const pending = e.approvalStatus === "PENDING";

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: `${base}/companies/${e.companyId}`, label: e.company.name }}
        title={e.fullName}
        subtitle={`Emp ID ${e.employeeCode} · ${e.company.name}`}
        actions={
          <>
            {canEdit && <EmployeeDialog companyId={e.companyId} employee={JSON.parse(JSON.stringify(e))} trigger={<button className="btn-secondary">Edit</button>} />}
            {canEdit && role !== "SUDO_ADMIN" && !pending && <EmployeeStatusToggle id={e.id} isActive={e.isActive} />}
            {role === "SUPER_ADMIN" && <DeleteButton url={`/api/employees/${e.id}`} what={e.fullName} back={`${base}/companies/${e.companyId}`} />}
            {isCm && e.isActive && !pending && <Link href={`${base}/referrals/new?employee=${e.id}`} className="btn-primary"><Icon name="plus" size={15} /> Raise referral</Link>}
          </>
        }
      />
      {e.deletionRequestedAt && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 ring-1 ring-red-200">
          <span className="text-sm text-red-800">Account deletion requested on {fmtDateTime(e.deletionRequestedAt)}. {role === "SUPER_ADMIN" ? (refs.total ? "This employee has referrals, so erase their personal data instead of deleting." : "Delete the employee to complete it.") : "Only the Super Admin can complete it."}</span>
          {role === "SUPER_ADMIN" && refs.total > 0 && e.fullName !== "Erased employee" && <EraseButton url={`/api/employees/${e.id}/erase`} what={e.fullName} />}
        </div>
      )}
      {pending && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
          <span className="text-sm text-amber-900">This employee registered themselves and is waiting for approval.</span>
          {canEdit && <RegistrationActions id={e.id} name={e.fullName} />}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Section title="Profile" className="lg:col-span-2" actions={e.approvalStatus === "REJECTED" ? <Badge tone="red">Rejected</Badge> : e.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Full name">{e.fullName}</Field>
            <Field label="Employee ID">{e.employeeCode}</Field>
            <Field label="Mobile (login)">{e.mobile}</Field>
            <Field label="Gender">{e.gender}</Field>
            <Field label="Date of birth">{fmtDate(e.dateOfBirth)} ({ageFrom(e.dateOfBirth)} yrs)</Field>
            <Field label="Blood group">{e.bloodGroup}</Field>
            <Field label="Email">{e.email}</Field>
            <Field label="Department">{e.department}</Field>
            <Field label="Designation">{e.designation}</Field>
            <Field label="Aadhaar (last 4)">{e.aadhaarLast4 ? `XXXX XXXX ${e.aadhaarLast4}` : null}</Field>
            <Field label="Address">{e.address}</Field>
            <Field label="Emergency contact">{e.emergencyName ? `${e.emergencyName}${e.emergencyMobile ? ` · ${e.emergencyMobile}` : ""}` : null}</Field>
            <Field label="Company"><Link className="link" href={`${base}/companies/${e.companyId}`}>{e.company.name}</Link></Field>
            <Field label="Cluster">{e.company.cluster?.name}</Field>
            <Field label="Last app login">{e.lastLoginAt ? fmtDateTime(e.lastLoginAt) : "Never"}</Field>
          </dl>
          {e.selfRegistered && <p className="mt-4 text-xs text-slate-500">Self-registered on {fmtDateTime(e.createdAt)}.</p>}
        </Section>
        <Section title="Referrals at a glance">
          <dl className="grid grid-cols-2 gap-3 text-center">
            {[["Total", refs.total], ["Open", refs.rows.filter((r) => !["COMPLETED", "CLOSED", "CANCELLED", "REJECTED", "DRAFT"].includes(r.status)).length], ["Completed", refs.rows.filter((r) => ["COMPLETED", "CLOSED"].includes(r.status)).length], ["Family", refs.rows.filter((r) => r.patientRelation && r.patientRelation !== "Self").length]].map(([l, n]) => (
              <div key={l} className="rounded-xl bg-gold-50/60 p-3 ring-1 ring-gold-100"><dt className="text-[11px] font-semibold uppercase tracking-wide text-gold-700">{l}</dt><dd className="font-display text-2xl font-bold text-brand-900">{n}</dd></div>
            ))}
          </dl>
        </Section>
      </div>

      <FamilyManager members={JSON.parse(JSON.stringify(family))} apiBase={`/api/employees/${e.id}/family`} staff canEdit={canEdit} canRemove={role === "SUPER_ADMIN" || isCm} />

      <Section title={`Referrals (${refs.total})`} actions={isCm && e.isActive && !pending ? <Link href={`${base}/referrals/new?employee=${e.id}`} className="btn-primary btn-sm">+ Raise referral</Link> : null}>
        {refs.rows.length ? (
          <div className="stagger grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {refs.rows.map((r) => <ReferralCard key={r.id} r={r} me={me} href={`${base}/referrals/${r.id}`} />)}
          </div>
        ) : <Empty title="No referrals yet">{isCm ? "Raise one for this employee or their family." : null}</Empty>}
      </Section>
    </div>
  );
}

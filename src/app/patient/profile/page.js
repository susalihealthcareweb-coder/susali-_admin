import { requirePage } from "@/lib/session";
import { Section, Field } from "@/components/ui";
import ProfileForm from "@/components/ProfileForm";
import FamilyManager from "@/components/FamilyManager";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Profile" };

export default async function Profile() {
  const me = await requirePage(["PATIENT"]);
  const e = me.employee;
  const family = await prisma.familyMember.findMany({ where: { employeeId: e.id, isActive: true }, orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-4">
      <h1 className="text-3xl text-brand-900">Profile</h1>
      <Section title="Employee details">
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Name">{e.fullName}</Field>
          <Field label="Employee ID">{e.employeeCode}</Field>
          <Field label="Company">{e.company?.name}</Field>
          <Field label="Mobile">{e.mobile}</Field>
          <Field label="Date of birth">{fmtDate(e.dateOfBirth)}</Field>
          <Field label="Gender">{e.gender}</Field>
          <Field label="Blood group">{e.bloodGroup}</Field>
          <Field label="Department">{e.department}</Field>
          <Field label="Designation">{e.designation}</Field>
        </dl>
        <p className="mt-3 text-xs text-slate-400">To correct these, contact your Cluster Manager.</p>
      </Section>
      <FamilyManager members={JSON.parse(JSON.stringify(family))} />
      <ProfileForm initial={{ email: e.email || "", address: e.address || "", emergencyName: e.emergencyName || "", emergencyMobile: e.emergencyMobile || "" }} />
    </div>
  );
}

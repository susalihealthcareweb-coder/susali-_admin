import Link from "next/link";
import { requirePage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { patientMasters } from "@/lib/patient-masters";
import ReferralForm from "@/components/ReferralForm";
import PatientCard from "@/components/PatientCard";
import AwaitingApproval from "@/components/AwaitingApproval";

export const metadata = { title: "New referral" };

export default async function NewReferral() {
  const me = await requirePage(["PATIENT"]);
  const e = me.employee;
  if (e.approvalStatus === "PENDING") return <AwaitingApproval company={e.company?.name} />;
  const [masters, family] = await Promise.all([
    patientMasters(),
    prisma.familyMember.findMany({ where: { employeeId: e.id, isActive: true }, select: { id: true, fullName: true, relation: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <div className="space-y-4">
      <Link href="/patient" className="text-xs font-medium text-slate-500">← Home</Link>
      <h1 className="text-3xl text-brand-900">New referral</h1>
      <p className="text-sm text-slate-500">Enter the details from the referral letter you received at the superintendent hospital.</p>
      <PatientCard e={e} />
      <ReferralForm masters={masters} family={family} holder={{ name: e.fullName }} />
    </div>
  );
}

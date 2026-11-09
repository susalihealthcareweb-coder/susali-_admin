import Link from "next/link";
import { requirePage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui";
import ProgressBar from "@/components/ProgressBar";
import { fmtDateTime } from "@/lib/format";
import AwaitingApproval from "@/components/AwaitingApproval";
import Icon from "@/components/Icon";

const NEXT_STEP = {
  DRAFT: "Finish your referral and upload the letter, then submit.",
  SUBMITTED: "Our team will verify your referral shortly.",
  UNDER_VERIFICATION: "Your referral is being verified.",
  INFO_REQUESTED: "We need more details. Open the referral to update and resubmit.",
  HOSPITAL_DECLINED: "The hospital could not take this referral. We are finding another hospital.",
  FORWARDED: "Verified and sent to the hospital. Wait for the hospital to accept.",
  ACCEPTED: "The hospital is expecting you. Carry your referral letter and ID card.",
  VISITED: "You have checked in at the hospital.",
  UNDER_TREATMENT: "Your treatment is in progress.",
  COMPLETED: "Your reports are ready in My Records.",
};

export default async function PatientHome() {
  const me = await requirePage(["PATIENT"]);
  const active = await prisma.referral.findMany({
    where: { employeeId: me.id, status: { notIn: ["CLOSED", "CANCELLED", "REJECTED"] } },
    orderBy: { updatedAt: "desc" },
    include: { hospital: { select: { name: true, address: true, city: true, phone: true } } },
    take: 5,
  });
  const pending = me.employee.approvalStatus === "PENDING";
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl text-brand-900">Hello, {me.name.split(" ")[0]} <span className="inline-block origin-[70%_70%] animate-[wave_1.6s_ease-in-out_1]">👋</span></h1>
        <p className="text-sm text-slate-500">{me.employee.company?.name}</p>
      </div>
      {pending && <AwaitingApproval company={me.employee.company?.name} />}
      {active.length ? active.map((r) => (
        <Link key={r.id} href={`/patient/referrals/${r.id}`} className="lift card card-pad block space-y-4 hover:border-brand-500">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-mono text-sm font-semibold">{r.status === "DRAFT" ? "Draft referral" : r.referralNo}</div>
              <div className="text-xs text-slate-500">{r.patientRelation && r.patientRelation !== "Self" ? <><b className="text-gold-700">{r.patientName}</b> ({r.patientRelation}) · </> : ""}Updated {fmtDateTime(r.updatedAt)}</div>
            </div>
            <StatusBadge status={r.status} />
          </div>
          {r.status !== "DRAFT" && <ProgressBar status={r.status} />}
          <p className={`rounded-lg px-3 py-2 text-sm ${r.status === "INFO_REQUESTED" ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-700"}`}>{NEXT_STEP[r.status]}</p>
          {["FORWARDED", "ACCEPTED"].includes(r.status) && r.hospital && (
            <div className="text-sm"><div className="font-medium">{r.hospital.name}</div><div className="text-slate-500">{r.hospital.address}, {r.hospital.city} · {r.hospital.phone}</div></div>
          )}
        </Link>
      )) : !pending && (
        <div className="card card-pad text-center">
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon name="heart" size={22} /></div>
          <p className="text-sm text-slate-600">You have no active referrals.</p>
        </div>
      )}
      {!pending && (
        <Link href="/patient/referrals/new" className="btn-primary group w-full py-3.5 text-base shadow-lg shadow-brand-700/20">
          <Icon name="plus" size={18} className="transition-transform duration-300 group-hover:rotate-90" /> New referral
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/patient/records" className="lift card card-pad flex flex-col items-center gap-2 text-sm font-medium hover:border-brand-500"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon name="folder" /></span>My records</Link>
        <Link href="/patient/referrals" className="lift card card-pad flex flex-col items-center gap-2 text-sm font-medium hover:border-brand-500"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon name="referral" /></span>All referrals</Link>
      </div>
    </div>
  );
}

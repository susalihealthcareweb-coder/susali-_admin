import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { referralDetail } from "@/lib/referral-queries";
import { patientMasters } from "@/lib/patient-masters";
import { getSettings } from "@/lib/settings";
import { StatusBadge, Section, Field } from "@/components/ui";
import ProgressBar from "@/components/ProgressBar";
import Timeline from "@/components/Timeline";
import ReferralForm from "@/components/ReferralForm";
import PatientCard from "@/components/PatientCard";
import PatientCancel from "@/components/PatientCancel";
import { DocumentList, Uploader } from "@/components/Documents";
import { fmtDate, patientOf } from "@/lib/format";
import { PATIENT_DOC_CATEGORIES, HOSPITAL_DOC_CATEGORIES } from "@/lib/constants";
import { PATIENT_CANCELLABLE } from "@/lib/referral-flow";

export const metadata = { title: "Referral" };

export default async function PatientReferral({ params }) {
  const me = await requirePage(["PATIENT"]);
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) notFound();
  const own = await prisma.referral.findFirst({ where: { id, employeeId: me.id }, select: { id: true } });
  if (!own) notFound();
  const r = await referralDetail(id);
  const editable = ["DRAFT", "INFO_REQUESTED"].includes(r.status);
  const [masters, settings, family] = await Promise.all([
    editable ? patientMasters() : null,
    getSettings(),
    editable ? prisma.familyMember.findMany({ where: { employeeId: me.id, isActive: true }, select: { id: true, fullName: true, relation: true }, orderBy: { createdAt: "asc" } }) : [],
  ]);
  const who = patientOf(r);
  const mine = r.documents.filter((d) => PATIENT_DOC_CATEGORIES.includes(d.category));
  const reports = r.documents.filter((d) => HOSPITAL_DOC_CATEGORIES.includes(d.category));
  const hasLetter = mine.some((d) => d.category === "REFERRAL_LETTER");
  const plain = (x) => JSON.parse(JSON.stringify(x));

  return (
    <div className="space-y-4">
      <Link href="/patient/referrals" className="text-xs font-medium text-slate-500">← My referrals</Link>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl text-brand-900">{r.status === "DRAFT" ? "Draft referral" : r.referralNo}</h1>
          <p className="text-sm text-slate-500">For <b className="text-slate-700">{who.name}</b>{who.relation !== "Self" ? ` · ${who.relation}` : " · yourself"}</p>
        </div>
        <StatusBadge status={r.status} />
      </div>
      {!["DRAFT", "CANCELLED", "REJECTED"].includes(r.status) && <div className="card card-pad"><ProgressBar status={r.status} /></div>}

      {r.status === "INFO_REQUESTED" && <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900"><b>More information needed:</b> {r.infoRequestNote}</div>}
      {r.status === "REJECTED" && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800"><b>Not approved:</b> {r.rejectReason}</div>}
      {["FORWARDED", "ACCEPTED"].includes(r.status) && r.hospital && (
        <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <b>Go to:</b> {r.hospital.name}, {r.hospital.address}, {r.hospital.city}. Phone {r.hospital.phone}. Show referral number <b className="font-mono">{r.referralNo}</b> at the desk.
        </div>
      )}

      {editable ? (
        <>
          <PatientCard e={me.employee} />
          <Section title="Referral letter and earlier reports">
            <div className="space-y-3">
              <Uploader referralId={r.id} categories={hasLetter ? ["PREVIOUS_REPORT", "REFERRAL_LETTER"] : ["REFERRAL_LETTER", "PREVIOUS_REPORT"]} maxMb={settings.maxFileMb} compact />
              <DocumentList documents={plain(mine)} deletable />
            </div>
          </Section>
          <ReferralForm referral={plain(r)} masters={masters} hasLetter={hasLetter} canSubmit family={family} holder={{ name: me.employee.fullName }} />
        </>
      ) : (
        <>
          {reports.length > 0 && (
            <Section title="Your reports">
              <DocumentList documents={plain(reports)} />
            </Section>
          )}
          <Section title="Referral details">
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Patient">{who.name}{who.relation !== "Self" ? ` (${who.relation})` : ""}</Field>
              <Field label="Hospital">{r.hospital?.name}</Field>
              <Field label="Department">{r.department?.name}</Field>
              <Field label="Dispensary">{r.dispensary?.name}</Field>
              <Field label="Superintendent hospital">{r.superintendentHospital?.name}</Field>
              <Field label="Letter no">{r.referralLetterNo}</Field>
              <Field label="Referral date">{fmtDate(r.referralDate)}</Field>
            </dl>
          </Section>
          {mine.length > 0 && <Section title="Letters you uploaded"><DocumentList documents={plain(mine)} group={false} /></Section>}
        </>
      )}

      <Section title="Timeline"><Timeline history={plain(r.history)} hideActorNames /></Section>
      {PATIENT_CANCELLABLE.includes(r.status) && <PatientCancel id={r.id} draft={r.status === "DRAFT"} />}
    </div>
  );
}

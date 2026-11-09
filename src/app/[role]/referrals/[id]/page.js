import { notFound } from "next/navigation";
import Link from "next/link";
import { staffPage } from "@/lib/page";
import { prisma } from "@/lib/prisma";
import { referralScope } from "@/lib/scope";
import { referralDetail } from "@/lib/referral-queries";
import { getSettings } from "@/lib/settings";
import { PageHeader, StatusBadge, UrgencyBadge, Section, Field, Badge } from "@/components/ui";
import Timeline from "@/components/Timeline";
import { DocumentList, Uploader } from "@/components/Documents";
import ReferralActions from "@/components/ReferralActions";
import ReferralForm from "@/components/ReferralForm";
import PatientCancel from "@/components/PatientCancel";
import { patientMasters } from "@/lib/patient-masters";
import { fmtDate, fmtDateTime, ageFrom, patientOf } from "@/lib/format";
import { HOSPITAL_DOC_CATEGORIES, PATIENT_DOC_CATEGORIES, VERIFIER_ROLES, STATUS } from "@/lib/constants";

export const metadata = { title: "Referral" };

export default async function ReferralPage({ params }) {
  const { me, base, role } = await staffPage(params);
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) notFound();
  const allowed = await prisma.referral.findFirst({ where: { AND: [{ id }, referralScope(me)] }, select: { id: true } });
  if (!allowed) notFound();
  const r = await referralDetail(id);
  const company = await prisma.company.findUnique({ where: { id: r.companyId }, select: { name: true, code: true, cluster: { select: { name: true } } } });
  const snap = r.patientSnapshot || {};
  const emp = r.employee;
  const who = patientOf(r);
  const fm = r.familyMember;
  // Details of the person treated: snapshot once submitted, else live record.
  const person = snap.patient || (fm ? { gender: fm.gender, age: ageFrom(fm.dateOfBirth), bloodGroup: fm.bloodGroup } : { gender: snap.gender || emp.gender, age: snap.age ?? ageFrom(emp.dateOfBirth), bloodGroup: snap.bloodGroup || emp.bloodGroup });
  const isVerifier = VERIFIER_ROLES.includes(role);
  const canSeeDocs = role !== "CLUSTER_MANAGER";
  // The Cluster Manager who raised this referral fills it in like the employee.
  const raiser = role === "CLUSTER_MANAGER" && r.raisedById === me.id;
  const raiserEditing = raiser && ["DRAFT", "INFO_REQUESTED"].includes(r.status);
  const [masters, family] = raiserEditing
    ? await Promise.all([patientMasters(), prisma.familyMember.findMany({ where: { employeeId: r.employeeId, isActive: true }, select: { id: true, fullName: true, relation: true }, orderBy: { createdAt: "asc" } })])
    : [null, []];
  const settings = await getSettings();

  const [hospitals, departments, verifiers, duplicates] = await Promise.all([
    isVerifier ? prisma.hospital.findMany({ where: { isActive: true }, select: { id: true, name: true, city: true, departmentIds: true }, orderBy: { name: "asc" } }) : [],
    isVerifier ? prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : [],
    ["SUPER_ADMIN", "SUDO_ADMIN"].includes(role) ? prisma.user.findMany({ where: { isActive: true, role: { in: VERIFIER_ROLES } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    isVerifier ? prisma.referral.findMany({ where: { id: { not: r.id }, employeeId: r.employeeId, hospitalId: r.hospitalId || undefined, status: { notIn: ["DRAFT", "REJECTED", "CANCELLED", "CLOSED"] } }, select: { id: true, referralNo: true, status: true, familyMemberId: true } }).then((x) => x.filter((d) => (d.familyMemberId || null) === (r.familyMemberId || null))) : [],
  ]);

  const letter = r.documents.filter((d) => PATIENT_DOC_CATEGORIES.includes(d.category));
  const medical = r.documents.filter((d) => HOSPITAL_DOC_CATEGORIES.includes(d.category));
  const hospitalCanUpload = role === "HOSPITAL_USER" && ["VISITED", "UNDER_TREATMENT", "COMPLETED"].includes(r.status);

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: role === "HOSPITAL_USER" ? base : `${base}/referrals`, label: role === "HOSPITAL_USER" ? "Dashboard" : "Referrals" }}
        title={r.referralNo}
        subtitle={`${who.name}${who.relation !== "Self" ? ` (${who.relation} of ${emp.fullName})` : ""} · ${company?.name}`}
        actions={<div className="flex items-center gap-2"><UrgencyBadge urgency={r.urgency} /><StatusBadge status={r.status} /></div>}
      />

      {r.status === "UNDER_VERIFICATION" && r.lockedBy && (
        <div className={`rounded-lg px-4 py-2.5 text-sm ${r.lockedById === me.id ? "bg-brand-50 text-brand-800" : "bg-amber-50 text-amber-800"}`}>
          🔒 {r.lockedById === me.id ? "You are verifying this referral." : `${r.lockedBy.name} is verifying this referral.`}
        </div>
      )}
      {isVerifier && duplicates.length > 0 && (
        <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-800">
          Possible duplicate: this patient has another open referral to the same hospital —{" "}
          {duplicates.map((d, i) => <span key={d.id}>{i ? ", " : ""}<Link className="underline" href={`${base}/referrals/${d.id}`}>{d.referralNo}</Link> ({STATUS[d.status].label})</span>)}
        </div>
      )}
      {r.escalations?.length > 0 && !["COMPLETED", "CLOSED", "CANCELLED", "REJECTED"].includes(r.status) && isVerifier && (
        <div className="rounded-lg bg-orange-50 px-4 py-2.5 text-sm text-orange-800">Escalated: past the time limit at stage {r.escalations.join(", ")}.</div>
      )}

      {raiserEditing && (
        <div className="space-y-4 rounded-2xl bg-gradient-to-br from-gold-50 to-white p-4 ring-1 ring-gold-200 sm:p-5">
          <div>
            <h2 className="font-display text-xl font-bold text-brand-900">{r.status === "INFO_REQUESTED" ? "Update and resubmit" : "Complete this referral"}</h2>
            <p className="text-sm text-slate-600">{r.status === "INFO_REQUESTED" ? `Support asked: ${r.infoRequestNote}` : `You are filling this in for ${emp.fullName}. Upload the referral letter, then submit.`}</p>
          </div>
          <Section title="Referral letter and earlier reports">
            <div className="space-y-3">
              <Uploader referralId={r.id} categories={["REFERRAL_LETTER", "PREVIOUS_REPORT"]} maxMb={settings.maxFileMb} compact />
              <DocumentList documents={JSON.parse(JSON.stringify(letter))} deletable />
            </div>
          </Section>
          <ReferralForm referral={JSON.parse(JSON.stringify(r))} masters={masters} hasLetter={letter.some((d) => d.category === "REFERRAL_LETTER")} canSubmit family={family} holder={{ name: emp.fullName, staff: true }} basePath={`${base}/referrals`} familyHref={`${base}/employees/${emp.id}#family`} />
          <PatientCancel id={r.id} draft={r.status === "DRAFT"} back={`${base}/referrals`} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Section title="Patient" actions={who.relation !== "Self" ? <Badge tone="amber">Family member · {who.relation}</Badge> : <Badge tone="teal">Employee (self)</Badge>}>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Patient name">{who.name}</Field>
              <Field label="Relation">{who.relation}</Field>
              <Field label="Age / Gender">{person.age ?? "—"} · {person.gender || "—"}</Field>
              <Field label="Blood group">{person.bloodGroup}</Field>
              {fm?.mobile && <Field label="Patient mobile">{fm.mobile}</Field>}
            </dl>
            <div className="mt-4 border-t border-[#efe7d6] pt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-700">Card holder (employee)</div>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Employee"><Link className="link" href={`${base}/employees/${emp.id}`}>{snap.name || emp.fullName}</Link></Field>
                <Field label="Employee ID">{snap.employeeCode || emp.employeeCode}</Field>
                <Field label="Employee status">{emp.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}</Field>
                <Field label="Mobile">{snap.mobile || emp.mobile}</Field>
                <Field label="Company">{company?.name} <span className="text-xs text-slate-500">({company?.code})</span></Field>
                <Field label="Cluster">{company?.cluster?.name}</Field>
              </dl>
            </div>
          </Section>

          <Section title="Referral details">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Dispensary visited">{r.dispensary?.name}</Field>
              <Field label="Dispensary visit date">{fmtDate(r.dispensaryVisitDate)}</Field>
              <Field label="Superintendent hospital">{r.superintendentHospital?.name}</Field>
              <Field label="Superintendent / doctor">{r.superintendentName}</Field>
              <Field label="Referral letter no">{r.referralLetterNo}</Field>
              <Field label="Referral date">{fmtDate(r.referralDate)}</Field>
              <Field label="Referred to hospital">{r.hospital?.name}</Field>
              <Field label="Department">{r.department?.name}</Field>
              <Field label="Submitted">{fmtDateTime(r.submittedAt)}</Field>
            </dl>
            {role !== "CLUSTER_MANAGER" && (
              <div className="mt-4"><Field label="Provisional diagnosis / reason"><span className="whitespace-pre-line">{r.diagnosis}</span></Field></div>
            )}
            {(r.verifierNotes || r.infoRequestNote || r.rejectReason || r.declineReason) && (
              <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                {r.verifierNotes && <p><b>Verifier notes:</b> {r.verifierNotes}</p>}
                {r.infoRequestNote && <p><b>Information requested:</b> {r.infoRequestNote}</p>}
                {r.rejectReason && <p><b>Rejected:</b> {r.rejectReason}</p>}
                {r.declineReason && <p><b>Hospital declined:</b> {r.declineReason}</p>}
              </div>
            )}
            {(r.visitType || r.treatingDoctor) && (
              <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
                <Field label="Visit type">{r.visitType === "ADMISSION" ? "Admission" : r.visitType}</Field>
                <Field label="Treating doctor">{r.treatingDoctor}</Field>
                <Field label="Admission date">{fmtDate(r.admissionDate)}</Field>
                {r.treatmentNotes && role !== "CLUSTER_MANAGER" && <div className="col-span-full"><Field label="Treatment notes"><span className="whitespace-pre-line">{r.treatmentNotes}</span></Field></div>}
              </dl>
            )}
          </Section>

          {canSeeDocs ? (
            <>
              <Section title="Referral letter and earlier reports">
                <DocumentList documents={JSON.parse(JSON.stringify(letter))} />
              </Section>
              {(role !== "SUPPORT" || medical.length > 0) && (
                <Section title="Hospital documents">
                  <div className="space-y-4">
                    {hospitalCanUpload && <Uploader referralId={r.id} categories={HOSPITAL_DOC_CATEGORIES} maxMb={settings.maxFileMb} />}
                    <DocumentList documents={JSON.parse(JSON.stringify(medical))} deletable={hospitalCanUpload && r.status !== "COMPLETED"} />
                  </div>
                </Section>
              )}
            </>
          ) : (
            <>
              {raiser && !raiserEditing && letter.length > 0 && <Section title="Letters you uploaded"><DocumentList documents={JSON.parse(JSON.stringify(letter))} group={false} /></Section>}
              <Section title="Documents"><p className="text-sm text-slate-500">Medical documents are visible only to the patient, the hospital and the verification team.</p></Section>
            </>
          )}
        </div>

        <div className="space-y-5">
          <ReferralActions
            role={role}
            me={{ id: me.id }}
            referral={JSON.parse(JSON.stringify({ id: r.id, referralNo: r.referralNo, status: r.status, lockedById: r.lockedById, hospitalId: r.hospitalId, departmentId: r.departmentId, visitType: r.visitType, treatingDoctor: r.treatingDoctor, admissionDate: r.admissionDate, treatmentNotes: r.treatmentNotes, hasPrescription: medical.some((d) => d.category === "PRESCRIPTION") }))}
            hospitals={hospitals}
            departments={departments}
            verifiers={verifiers}
            base={base}
          />
          <Section title="Timeline">
            <Timeline history={JSON.parse(JSON.stringify(r.history))} />
          </Section>
        </div>
      </div>
    </div>
  );
}

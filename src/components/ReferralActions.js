"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "./Dialog";
import { api, run } from "./api-client";
import { STATUS, REJECT_REASONS, DECLINE_REASONS, VERIFIER_ROLES } from "@/lib/constants";
import { toInputDate } from "@/lib/format";

// The action panel on a referral: what this person may do at this status.
export default function ReferralActions({ role, me, referral: r, hospitals, departments, verifiers, base }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);

  const act = async (action, data, success) => {
    setBusy(true);
    const ok = await run(() => api(`/api/referrals/${r.id}/${action}`, { method: "POST", data: data || {} }), success);
    setBusy(false);
    if (ok) {
      setDialog(null);
      router.refresh();
    }
    return ok;
  };

  const isVerifier = VERIFIER_ROLES.includes(role);
  const isAdmin = role === "SUPER_ADMIN" || role === "SUDO_ADMIN";
  const lockedByMe = r.lockedById === me.id;
  const fresh = ["SUBMITTED", "HOSPITAL_DECLINED"].includes(r.status);
  const canDecide = fresh || (r.status === "UNDER_VERIFICATION" && (lockedByMe || isAdmin));
  const blocks = [];

  if (isVerifier) {
    if (r.status === "HOSPITAL_DECLINED") {
      blocks.push(<p key="declined" className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">The hospital declined. Choose another hospital below and accept to forward it again.</p>);
    }
    if (canDecide) {
      blocks.push(<ForwardForm key="fwd" r={r} hospitals={hospitals} departments={departments} busy={busy} onSubmit={(d) => act("forward", d, "Verified and forwarded")} />);
      blocks.push(
        <div key="decide" className="grid grid-cols-2 gap-2">
          <button className="btn-danger" disabled={busy} onClick={() => setDialog("reject")}>Reject</button>
          <button className="btn-secondary" disabled={busy} onClick={() => setDialog("info")}>Ask for details</button>
          {fresh ? (
            <button className="btn-ghost col-span-2 text-xs" disabled={busy} onClick={() => act("lock", null, "Locked to you for review")}>Lock for review so no one else picks it up</button>
          ) : (
            <button className="btn-ghost col-span-2" disabled={busy} onClick={() => act("unlock", null, "Returned to the queue")}>Release back to queue</button>
          )}
        </div>
      );
    }
    if (r.status === "UNDER_VERIFICATION" && !lockedByMe && isAdmin && verifiers.length) {
      blocks.push(<button key="reassign" className="btn-secondary w-full" onClick={() => setDialog("reassign")}>Reassign verifier</button>);
    }
    if (r.status === "COMPLETED") {
      blocks.push(<button key="close" className="btn-primary w-full" disabled={busy} onClick={() => act("close", {}, "Referral closed")}>Close after follow-up</button>);
    }
    if (isAdmin && ["REJECTED", "CLOSED"].includes(r.status)) {
      blocks.push(<button key="reopen" className="btn-secondary w-full" onClick={() => setDialog("reopen")}>Reopen referral</button>);
    }
    if (["SUBMITTED", "UNDER_VERIFICATION", "INFO_REQUESTED", "FORWARDED", "HOSPITAL_DECLINED"].includes(r.status)) {
      blocks.push(<button key="cancel" className="btn-ghost w-full text-red-700" onClick={() => setDialog("cancel")}>Cancel referral</button>);
    }
    if (role === "SUPER_ADMIN") {
      blocks.push(<button key="override" className="btn-ghost w-full text-slate-500" onClick={() => setDialog("override")}>Override status…</button>);
    }
  }

  if (role === "HOSPITAL_USER") {
    if (r.status === "FORWARDED") {
      blocks.push(
        <div key="accept" className="grid grid-cols-2 gap-2">
          <button className="btn-primary" disabled={busy} onClick={() => act("accept", null, "Referral accepted")}>Accept</button>
          <button className="btn-secondary text-red-700" disabled={busy} onClick={() => setDialog("decline")}>Decline</button>
        </div>
      );
    }
    if (r.status === "ACCEPTED") {
      blocks.push(<button key="visit" className="btn-primary w-full" onClick={() => setDialog("visit")}>Mark patient visited</button>);
    }
    if (["VISITED", "UNDER_TREATMENT"].includes(r.status)) {
      blocks.push(<button key="treat" className="btn-secondary w-full" onClick={() => setDialog("treatment")}>{r.status === "VISITED" ? "Start treatment (OPD / admission)" : "Update treatment details"}</button>);
      blocks.push(
        <div key="complete">
          <button className="btn-primary w-full" disabled={busy || !r.hasPrescription} onClick={() => confirm("Complete this case? The patient will be told their reports are ready.") && act("complete", null, "Case completed")}>Complete case</button>
          {!r.hasPrescription && <p className="mt-1 text-xs text-slate-500">Upload at least one prescription first.</p>}
        </div>
      );
    }
  }

  if (!blocks.length) {
    blocks.push(<p key="none" className="text-sm text-slate-500">{role === "CLUSTER_MANAGER" ? "Support verifies this referral; you can track its progress here." : "No actions available at this stage."}</p>);
  }

  return (
    <section className="card">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5"><h2 className="text-sm font-semibold text-slate-800">Actions</h2></div>
      <div className="space-y-3 p-4 sm:p-5">{blocks}</div>

      <TextDialog open={dialog === "info"} title="Request information" label="What is missing or needs correcting?" field="note" min={5} onClose={() => setDialog(null)} busy={busy} submitLabel="Send to patient" onSubmit={(d) => act("request-info", d, "Sent back to the patient")} />
      <ReasonDialog open={dialog === "reject"} title="Reject referral" reasons={REJECT_REASONS} requireRemarks onClose={() => setDialog(null)} busy={busy} danger submitLabel="Reject" onSubmit={(d) => act("reject", d, "Referral rejected")} />
      <ReasonDialog open={dialog === "decline"} title="Decline referral" reasons={DECLINE_REASONS} onClose={() => setDialog(null)} busy={busy} danger submitLabel="Decline" note="The referral goes back to the Verification Queue so it can be sent to another hospital." onSubmit={(d) => act("decline", d, "Referral declined")} />
      <TextDialog open={dialog === "cancel"} title="Cancel referral" label="Reason" field="reason" min={0} onClose={() => setDialog(null)} busy={busy} danger submitLabel="Cancel referral" onSubmit={(d) => act("cancel", d, "Referral cancelled")} />
      <TextDialog open={dialog === "reopen"} title="Reopen referral" label="Reason for reopening" field="remarks" min={3} onClose={() => setDialog(null)} busy={busy} submitLabel="Reopen" onSubmit={(d) => act("reopen", d, "Referral reopened")} />
      <OverrideDialog open={dialog === "override"} onClose={() => setDialog(null)} busy={busy} current={r.status} onSubmit={(d) => act("override", d, "Status overridden")} />
      <ReassignDialog open={dialog === "reassign"} onClose={() => setDialog(null)} busy={busy} verifiers={verifiers} onSubmit={(d) => act("reassign", d, "Reassigned")} />
      <VisitDialog open={dialog === "visit"} onClose={() => setDialog(null)} busy={busy} r={r} onSubmit={(d) => act("visit", d, "Patient marked as visited")} />
      <TreatmentDialog open={dialog === "treatment"} onClose={() => setDialog(null)} busy={busy} r={r} onSubmit={(d) => act("treatment", d, "Treatment details saved")} />
    </section>
  );
}

function ForwardForm({ r, hospitals, departments, busy, onSubmit }) {
  const [hospitalId, setHospitalId] = useState(r.hospitalId || "");
  const [departmentId, setDepartmentId] = useState(r.departmentId || "");
  const [notes, setNotes] = useState("");
  const h = hospitals.find((x) => x.id === hospitalId);
  const depts = h?.departmentIds?.length ? departments.filter((d) => h.departmentIds.includes(d.id)) : departments;
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({ hospitalId, departmentId, notes }); }}>
      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        Check: employee is active, the letter is readable and matches the details, the hospital and department are right, and there is no duplicate open referral.
      </div>
      <div>
        <label className="label">Forward to hospital</label>
        <select className="input" value={hospitalId} onChange={(e) => setHospitalId(e.target.value)} required>
          <option value="">Choose…</option>
          {hospitals.map((x) => <option key={x.id} value={x.id}>{x.name}{x.city ? `, ${x.city}` : ""}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Department</label>
        <select className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
          <option value="">Choose…</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {h && departmentId && !depts.some((d) => d.id === departmentId) && <p className="mt-1 text-xs text-amber-700">This hospital does not list the selected department.</p>}
      </div>
      <div>
        <label className="label">Notes for the hospital (optional)</label>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      </div>
      <button className="btn-primary w-full py-2.5" disabled={busy || !hospitalId || !departmentId}><span aria-hidden="true">✓</span> Accept & forward to hospital</button>
    </form>
  );
}

function Footer({ onClose, busy, danger, label, form }) {
  return (
    <>
      <button type="button" className="btn-secondary" onClick={onClose}>Back</button>
      <button type="submit" form={form} className={danger ? "btn-danger" : "btn-primary"} disabled={busy}>{busy ? "Saving…" : label}</button>
    </>
  );
}

function TextDialog({ open, title, label, field, min, onClose, onSubmit, busy, danger, submitLabel }) {
  const [text, setText] = useState("");
  const id = `f-${field}-${title.replace(/\W/g, "")}`;
  return (
    <Dialog open={open} onClose={onClose} title={title} footer={<Footer onClose={onClose} busy={busy} danger={danger} label={submitLabel} form={id} />}>
      <form id={id} onSubmit={(e) => { e.preventDefault(); onSubmit({ [field]: text }); }}>
        <label className="label">{label}</label>
        <textarea className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} minLength={min || undefined} required={min > 0} maxLength={1000} />
      </form>
    </Dialog>
  );
}

function ReasonDialog({ open, title, reasons, requireRemarks, onClose, onSubmit, busy, danger, submitLabel, note }) {
  const [reason, setReason] = useState(reasons[0]);
  const [remarks, setRemarks] = useState("");
  const id = `f-${title.replace(/\W/g, "")}`;
  return (
    <Dialog open={open} onClose={onClose} title={title} footer={<Footer onClose={onClose} busy={busy} danger={danger} label={submitLabel} form={id} />}>
      <form id={id} className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({ reason, remarks }); }}>
        {note && <p className="text-sm text-slate-600">{note}</p>}
        <div>
          <label className="label">Reason</label>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>{reasons.map((x) => <option key={x}>{x}</option>)}</select>
        </div>
        <div>
          <label className="label">Remarks{requireRemarks ? "" : " (optional)"}</label>
          <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} required={requireRemarks} minLength={requireRemarks ? 3 : undefined} maxLength={1000} />
        </div>
      </form>
    </Dialog>
  );
}

function OverrideDialog({ open, onClose, onSubmit, busy, current }) {
  const [status, setStatus] = useState(current);
  const [remarks, setRemarks] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title="Override status" footer={<Footer onClose={onClose} busy={busy} danger label="Override" form="f-override" />}>
      <form id="f-override" className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({ status, remarks }); }}>
        <p className="text-sm text-amber-700">This skips the normal workflow checks and is written to the audit log.</p>
        <div><label className="label">New status</label><select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        <div><label className="label">Reason</label><textarea className="input" rows={3} required minLength={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
      </form>
    </Dialog>
  );
}

function ReassignDialog({ open, onClose, onSubmit, busy, verifiers }) {
  const [userId, setUserId] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title="Reassign verifier" footer={<Footer onClose={onClose} busy={busy} label="Reassign" form="f-reassign" />}>
      <form id="f-reassign" onSubmit={(e) => { e.preventDefault(); onSubmit({ userId }); }}>
        <label className="label">Give this referral to</label>
        <select className="input" required value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">Choose…</option>{verifiers.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
      </form>
    </Dialog>
  );
}

// Confirm identity by referral number plus the patient's mobile OTP or ID card.
function VisitDialog({ open, onClose, onSubmit, busy, r }) {
  const [referralNo, setReferralNo] = useState("");
  const [method, setMethod] = useState("OTP");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(null);
  const [sending, setSending] = useState(false);
  const sendOtp = async () => {
    setSending(true);
    const res = await run(() => api(`/api/referrals/${r.id}/visit-otp`, { method: "POST", data: {} }));
    setSending(false);
    if (res) setSent(res.referral.otpSentTo);
  };
  return (
    <Dialog open={open} onClose={onClose} title="Mark patient visited" footer={<Footer onClose={onClose} busy={busy} label="Confirm visit" form="f-visit" />}>
      <form id="f-visit" className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({ referralNo, method, otp }); }}>
        <div>
          <label className="label">Referral number from the patient</label>
          <input className="input font-mono uppercase" required value={referralNo} onChange={(e) => setReferralNo(e.target.value)} placeholder={r.referralNo.replace(/\d{6}$/, "000000")} />
        </div>
        <fieldset>
          <legend className="label">Confirm identity by</legend>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={method === "OTP"} onChange={() => setMethod("OTP")} /> Mobile OTP</label>
            <label className="flex items-center gap-2"><input type="radio" checked={method === "ID_CARD"} onChange={() => setMethod("ID_CARD")} /> Employee ID card</label>
          </div>
        </fieldset>
        {method === "OTP" ? (
          <div className="flex items-end gap-2">
            <div className="flex-1"><label className="label">OTP {sent && <span className="font-normal text-slate-500">sent to {sent}</span>}</label><input className="input tracking-widest" inputMode="numeric" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} /></div>
            <button type="button" className="btn-secondary" onClick={sendOtp} disabled={sending}>{sent ? "Resend" : "Send OTP"}</button>
          </div>
        ) : (
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1" /> I have checked the patient&apos;s employee ID card and it matches this referral.</label>
        )}
      </form>
    </Dialog>
  );
}

function TreatmentDialog({ open, onClose, onSubmit, busy, r }) {
  const [visitType, setVisitType] = useState(r.visitType || "OPD");
  const [treatingDoctor, setDoctor] = useState(r.treatingDoctor || "");
  const [admissionDate, setAdmission] = useState(toInputDate(r.admissionDate));
  const [notes, setNotes] = useState(r.treatmentNotes || "");
  return (
    <Dialog open={open} onClose={onClose} title="Treatment details" footer={<Footer onClose={onClose} busy={busy} label="Save" form="f-treat" />}>
      <form id="f-treat" className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({ visitType, treatingDoctor, admissionDate: visitType === "ADMISSION" ? admissionDate : null, notes }); }}>
        <div><label className="label">Visit type</label><select className="input" value={visitType} onChange={(e) => setVisitType(e.target.value)}><option value="OPD">OPD</option><option value="ADMISSION">Admission</option></select></div>
        <div><label className="label">Treating doctor</label><input className="input" value={treatingDoctor} onChange={(e) => setDoctor(e.target.value)} /></div>
        {visitType === "ADMISSION" && <div><label className="label">Admission date</label><input type="date" className="input" required value={admissionDate} onChange={(e) => setAdmission(e.target.value)} /></div>}
        <div><label className="label">Notes</label><textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </form>
    </Dialog>
  );
}

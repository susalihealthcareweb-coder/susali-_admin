import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { getScopedReferral } from "@/lib/scope";
import { changeStatus } from "@/lib/referral-actions";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { nextReferralNo } from "@/lib/counter";
import { sendOtpTo, verifyOtpFor, OTP_MESSAGES } from "@/lib/otp";
import { REQUIRED_FOR_SUBMIT, v } from "@/lib/validators";
import { PATIENT_CANCELLABLE, STAFF_CANCELLABLE } from "@/lib/referral-flow";
import { VERIFIER_ROLES, ADMIN_ROLES, REJECT_REASONS, DECLINE_REASONS, STATUS } from "@/lib/constants";
import { beneficiaryFields, patientSnapshot } from "@/lib/family";
import { patientSideEmployee, isRaiser } from "@/lib/referral-owner";

// One handler per status action, all under /api/referrals/:id/<action>.
// Each checks role, scope and the lifecycle before changing anything.
const ACTIONS = {
  // Patient submits or resubmits.
  async submit(me, r, req) {
    must(me, ["PATIENT", "CLUSTER_MANAGER"]);
    const emp = await patientSideEmployee(me, r);
    if (emp.approvalStatus === "PENDING") throw new ApiError(403, "This employee's registration is waiting for approval.");
    const missing = Object.entries(REQUIRED_FOR_SUBMIT).filter(([k]) => !r[k]).map(([, label]) => label);
    if (missing.length) throw new ApiError(400, `Please complete: ${missing.join(", ")}.`);
    const letter = await prisma.document.count({ where: { referralId: r.id, category: "REFERRAL_LETTER", isDeleted: false } });
    if (!letter) throw new ApiError(400, "Please upload the referral letter (photo or PDF).");
    const hospital = await prisma.hospital.findUnique({ where: { id: r.hospitalId } });
    if (!hospital?.isActive) throw new ApiError(400, "The selected hospital is not available. Choose another.");
    const company = await prisma.company.findUnique({ where: { id: emp.companyId }, select: { name: true } });
    const who = await beneficiaryFields(emp, r.familyMemberId);
    const snapshot = await patientSnapshot(emp, company?.name, who.familyMemberId);
    const data = { ...who, patientSnapshot: snapshot, submittedAt: new Date(), escalations: [], infoRequestNote: r.status === "INFO_REQUESTED" ? r.infoRequestNote : null };
    if (r.status === "DRAFT") data.referralNo = await nextReferralNo();
    const by = me.role === "CLUSTER_MANAGER" ? " by Cluster Manager" : "";
    const updated = await changeStatus({ referral: r, to: "SUBMITTED", me, data, remarks: (r.status === "INFO_REQUESTED" ? "Resubmitted with updated details" : "Submitted") + by, req });
    await notify("REFERRAL_SUBMITTED", { referral: updated });
    return updated;
  },

  // Verifier takes the referral from the queue; only one person at a time.
  async lock(me, r, req) {
    must(me, VERIFIER_ROLES);
    if (r.status === "UNDER_VERIFICATION") {
      if (r.lockedById === me.id) return r;
      const who = await prisma.user.findUnique({ where: { id: r.lockedById }, select: { name: true } });
      throw new ApiError(409, `${who?.name || "Another user"} is already verifying this referral.`);
    }
    return changeStatus({ referral: r, to: "UNDER_VERIFICATION", me, data: { lockedById: me.id }, remarks: r.status === "HOSPITAL_DECLINED" ? "Picked up for re-routing" : "Verification started", req });
  },

  // Put it back in the queue without a decision.
  async unlock(me, r, req) {
    must(me, VERIFIER_ROLES);
    holdsLock(me, r);
    return changeStatus({ referral: r, to: "SUBMITTED", me, data: { lockedById: null }, remarks: "Released back to the queue", req });
  },

  async forward(me, r, req, input) {
    must(me, VERIFIER_ROLES);
    r = await ensureLock(me, r, req);
    const d = z.object({ hospitalId: v.optObjectId, departmentId: v.optObjectId, notes: v.optStr }).parse(input);
    const hospitalId = d.hospitalId || r.hospitalId;
    const departmentId = d.departmentId || r.departmentId;
    const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!hospital?.isActive) throw new ApiError(400, "Choose an active hospital.");
    const changed = hospitalId !== r.hospitalId ? ` (hospital changed to ${hospital.name})` : "";
    const updated = await changeStatus({
      referral: r, to: "FORWARDED", me, req,
      data: { hospitalId, departmentId, verifierNotes: d.notes, verifiedById: me.id, lockedById: null, forwardedAt: new Date(), declineReason: null, escalations: [] },
      remarks: `Verified and forwarded to ${hospital.name}${changed}${d.notes ? ". Notes: " + d.notes : ""}`,
    });
    await notify("REFERRAL_FORWARDED", { referral: updated });
    return updated;
  },

  async "request-info"(me, r, req, input) {
    must(me, VERIFIER_ROLES);
    r = await ensureLock(me, r, req);
    const { note } = z.object({ note: z.string().trim().min(5, "Describe what is missing").max(1000) }).parse(input);
    const updated = await changeStatus({ referral: r, to: "INFO_REQUESTED", me, data: { infoRequestNote: note, lockedById: null }, remarks: note, req });
    await notify("INFO_REQUESTED", { referral: updated });
    return updated;
  },

  async reject(me, r, req, input) {
    must(me, VERIFIER_ROLES);
    r = await ensureLock(me, r, req);
    const d = z.object({ reason: z.enum(REJECT_REASONS), remarks: z.string().trim().min(3, "Add remarks").max(1000) }).parse(input);
    const reason = `${d.reason}: ${d.remarks}`;
    const updated = await changeStatus({ referral: r, to: "REJECTED", me, data: { rejectReason: reason, lockedById: null }, remarks: reason, req });
    await notify("REFERRAL_REJECTED", { referral: updated });
    return updated;
  },

  async accept(me, r, req) {
    must(me, ["HOSPITAL_USER"]);
    const updated = await changeStatus({ referral: r, to: "ACCEPTED", me, data: { acceptedAt: new Date(), escalations: [] }, remarks: "Accepted by hospital", req });
    await notify("HOSPITAL_ACCEPTED", { referral: updated });
    return updated;
  },

  // Decline sends it back to the Verification Queue for another hospital.
  async decline(me, r, req, input) {
    must(me, ["HOSPITAL_USER"]);
    const d = z.object({ reason: z.enum(DECLINE_REASONS), remarks: v.optStr }).parse(input);
    const reason = d.remarks ? `${d.reason}: ${d.remarks}` : d.reason;
    const hospital = await prisma.hospital.findUnique({ where: { id: r.hospitalId }, select: { name: true } });
    const updated = await changeStatus({ referral: r, to: "HOSPITAL_DECLINED", me, data: { declineReason: `${hospital?.name}: ${reason}` }, remarks: `Declined by ${hospital?.name}: ${reason}`, req });
    await audit({ actor: me, action: "REFERRAL_DECLINED", entity: "Hospital", entityId: r.hospitalId, after: { referralId: r.id, reason }, req });
    await notify("HOSPITAL_DECLINED", { referral: { ...updated, hospital: { ...updated.hospital } } });
    return updated;
  },

  // Sends an OTP to the patient's phone to confirm identity at the desk.
  async "visit-otp"(me, r) {
    must(me, ["HOSPITAL_USER"]);
    if (r.status !== "ACCEPTED") throw new ApiError(409, "Accept the referral first.");
    const emp = await prisma.employee.findUnique({ where: { id: r.employeeId } });
    const res = await sendOtpTo(emp.mobile, "VISIT");
    if (res !== "ok") throw new ApiError(429, OTP_MESSAGES[res]);
    return { ...r, otpSentTo: "******" + emp.mobile.slice(-4) };
  },

  async visit(me, r, req, input) {
    must(me, ["HOSPITAL_USER"]);
    const d = z.object({ method: z.enum(["OTP", "ID_CARD"]), otp: z.string().optional(), referralNo: z.string().trim() }).parse(input);
    if (d.referralNo.toUpperCase() !== r.referralNo) throw new ApiError(400, "Referral number does not match.");
    if (d.method === "OTP") {
      const emp = await prisma.employee.findUnique({ where: { id: r.employeeId } });
      const res = await verifyOtpFor(emp.mobile, String(d.otp || ""), "VISIT");
      if (res !== "ok") throw new ApiError(400, OTP_MESSAGES[res] || "OTP check failed.");
    }
    const updated = await changeStatus({
      referral: r, to: "VISITED", me, req,
      data: { visitedAt: new Date(), escalations: [] },
      remarks: `Patient arrived; identity confirmed by ${d.method === "OTP" ? "mobile OTP" : "employee ID card"}`,
    });
    await notify("PATIENT_VISITED", { referral: updated });
    return updated;
  },

  // Sets Under Treatment, or updates care details if already there.
  async treatment(me, r, req, input) {
    must(me, ["HOSPITAL_USER"]);
    const d = z.object({
      visitType: z.enum(["OPD", "ADMISSION"]),
      treatingDoctor: v.optStr,
      admissionDate: v.optDate,
      notes: z.string().trim().max(2000).optional().nullable(),
    }).parse(input);
    const data = { visitType: d.visitType, treatingDoctor: d.treatingDoctor, admissionDate: d.admissionDate, treatmentNotes: d.notes || null };
    if (r.status === "UNDER_TREATMENT") {
      const updated = await prisma.referral.update({ where: { id: r.id }, data, include: { employee: true, hospital: true } });
      await audit({ actor: me, action: "UPDATE", entity: "Referral", entityId: r.id, after: data, req });
      return updated;
    }
    return changeStatus({ referral: r, to: "UNDER_TREATMENT", me, data, remarks: `${d.visitType === "OPD" ? "OPD" : "Admission"}${d.treatingDoctor ? " under " + d.treatingDoctor : ""}`, req });
  },

  async complete(me, r, req) {
    must(me, ["HOSPITAL_USER"]);
    const rx = await prisma.document.count({ where: { referralId: r.id, category: "PRESCRIPTION", isDeleted: false } });
    if (!rx) throw new ApiError(400, "Upload at least one prescription before completing the case.");
    const updated = await changeStatus({ referral: r, to: "COMPLETED", me, data: { completedAt: new Date() }, remarks: "Case completed; reports uploaded", req });
    await notify("CASE_COMPLETED", { referral: updated });
    return updated;
  },

  async cancel(me, r, req, input) {
    const { reason } = z.object({ reason: z.string().trim().max(500).optional() }).parse(input || {});
    if (me.role === "PATIENT" || isRaiser(me, r)) {
      if (!PATIENT_CANCELLABLE.includes(r.status)) throw new ApiError(409, "This referral can no longer be cancelled.");
    } else {
      must(me, VERIFIER_ROLES);
      if (!STAFF_CANCELLABLE.includes(r.status)) throw new ApiError(409, "This referral can no longer be cancelled.");
    }
    return changeStatus({ referral: r, to: "CANCELLED", me, data: { lockedById: null }, remarks: reason || "Cancelled", req });
  },

  // Support closes a completed case after follow-up.
  async close(me, r, req, input) {
    must(me, VERIFIER_ROLES);
    const { remarks } = z.object({ remarks: z.string().trim().max(500).optional() }).parse(input || {});
    return changeStatus({ referral: r, to: "CLOSED", me, data: { closedAt: new Date() }, remarks: remarks || "Closed after follow-up", req });
  },

  async reopen(me, r, req, input) {
    must(me, ADMIN_ROLES);
    const { remarks } = z.object({ remarks: z.string().trim().min(3, "Give a reason").max(500) }).parse(input || {});
    if (r.status === "REJECTED") {
      return changeStatus({ referral: r, to: "SUBMITTED", me, data: { rejectReason: null, lockedById: null, submittedAt: new Date(), escalations: [] }, remarks: `Reopened: ${remarks}`, req, action: "REOPEN" });
    }
    if (r.status === "CLOSED") {
      return changeStatus({ referral: r, to: "COMPLETED", me, data: { closedAt: null }, remarks: `Reopened: ${remarks}`, req, action: "REOPEN" });
    }
    throw new ApiError(409, "Only rejected or closed referrals can be reopened.");
  },

  // Admins hand a locked referral to another verifier.
  async reassign(me, r, req, input) {
    must(me, ADMIN_ROLES);
    const { userId } = z.object({ userId: v.objectId }).parse(input);
    if (r.status !== "UNDER_VERIFICATION") throw new ApiError(409, "Only referrals under verification can be reassigned.");
    const to = await prisma.user.findFirst({ where: { id: userId, isActive: true, role: { in: VERIFIER_ROLES } } });
    if (!to) throw new ApiError(400, "Choose an active Support Team member or admin.");
    const updated = await prisma.referral.update({ where: { id: r.id }, data: { lockedById: to.id }, include: { employee: true, hospital: true } });
    await prisma.referralStatusHistory.create({ data: { referralId: r.id, fromStatus: r.status, toStatus: r.status, actorUserId: me.id, remarks: `Reassigned to ${to.name}` } });
    await audit({ actor: me, action: "REASSIGN", entity: "Referral", entityId: r.id, before: { lockedById: r.lockedById }, after: { lockedById: to.id }, req });
    return updated;
  },

  // Super Admin may set any status; always audited with a reason.
  async override(me, r, req, input) {
    must(me, ["SUPER_ADMIN"]);
    const d = z.object({ status: z.enum(Object.keys(STATUS)), remarks: z.string().trim().min(3, "Give a reason").max(500) }).parse(input);
    const stamp = { FORWARDED: "forwardedAt", ACCEPTED: "acceptedAt", VISITED: "visitedAt", COMPLETED: "completedAt", CLOSED: "closedAt", SUBMITTED: "submittedAt" }[d.status];
    const data = { lockedById: d.status === "UNDER_VERIFICATION" ? r.lockedById || me.id : null };
    if (stamp) data[stamp] = new Date();
    return changeStatus({ referral: r, to: d.status, me, data, remarks: `Override by Super Admin: ${d.remarks}`, req, force: true, action: "OVERRIDE" });
  },
};

// Accept / reject straight from the queue: take the referral first if no
// one is verifying it yet, so it still passes through Under Verification.
async function ensureLock(me, r, req) {
  if (["SUBMITTED", "HOSPITAL_DECLINED"].includes(r.status)) {
    const locked = await changeStatus({ referral: r, to: "UNDER_VERIFICATION", me, data: { lockedById: me.id }, remarks: "Verification started", req });
    return prisma.referral.findUnique({ where: { id: locked.id } });
  }
  holdsLock(me, r);
  return r;
}

function must(me, roles) {
  if (!roles.includes(me.role)) throw new ApiError(403, "You do not have access to this action.");
}

// Only the person holding the lock (or an admin) acts on a locked referral.
function holdsLock(me, r) {
  if (r.status !== "UNDER_VERIFICATION") throw new ApiError(409, "Start verification first.");
  if (r.lockedById !== me.id && !ADMIN_ROLES.includes(me.role)) {
    throw new ApiError(409, "Another user is verifying this referral.");
  }
}

export const POST = route(async (req, { id, action }) => {
  const fn = ACTIONS[action];
  if (!fn) throw new ApiError(404, "Unknown action.");
  const me = await requireApi();
  const r = await getScopedReferral(me, id);
  let input = {};
  if (req.headers.get("content-type")?.includes("application/json")) {
    input = await body(req, z.any()).catch(() => ({}));
  }
  const result = await fn(me, r, req, input || {});
  return ok({ referral: result });
});

import { after } from "next/server";
import { prisma } from "./prisma";
import { msg91SendWhatsApp } from "./msg91";
import { sendEmail, emailHtml } from "./mailer";
import { getTemplateOverrides } from "./settings";
import { STATUS, homeFor } from "./constants";
import { fmtDateTime, patientOf } from "./format";

const W = "WHATSAPP", E = "EMAIL", A = "IN_APP";

// Who gets which channel, per event (section 7 of the spec).
// Messages carry only referral number, status, hospital and a login link,
// never diagnosis or report contents.
export const EVENTS = {
  EMPLOYEE_ADDED: {
    label: "Employee added",
    to: { patient: [W] },
    template: "susali_welcome",
    title: () => "Welcome to SUSALI",
    body: (c) => `Hi ${c.name}, you are registered on SUSALI by ${c.company}. Log in with this mobile number to raise and track hospital referrals.`,
    vars: (c) => [c.name, c.company, c.patientLink],
  },
  REFERRAL_SUBMITTED: {
    label: "Referral submitted",
    to: { cm: [W, E, A], support: [W, E, A], sudo: [W, E, A], super: [A], patient: [W] },
    template: "susali_referral_submitted",
    title: (c) => `New referral ${c.no}`,
    body: (c) => `${c.name} (Emp ID ${c.empCode}, ${c.company}) submitted referral ${c.no} for ${c.hospital}. It is waiting for verification.`,
    patientBody: (c) => `Your referral ${c.no} has been received and will be verified shortly.`,
    vars: (c) => [c.name, c.empCode, c.company, c.no, c.hospital, c.link],
  },
  INFO_REQUESTED: {
    label: "Information requested",
    to: { cm: [A], patient: [W, E, A] },
    template: "susali_info_requested",
    title: (c) => `More details needed for ${c.no}`,
    body: (c) => `Referral ${c.no} needs more information from ${c.name}.`,
    patientBody: (c) => `Your referral ${c.no} needs more details. Please open the app, update it and resubmit.`,
    vars: (c) => [c.name, c.no, c.link],
  },
  REFERRAL_REJECTED: {
    label: "Referral rejected",
    to: { cm: [W, A], sudo: [A], patient: [W, E, A] },
    template: "susali_referral_rejected",
    title: (c) => `Referral ${c.no} rejected`,
    body: (c) => `Referral ${c.no} for ${c.name} (${c.company}) was rejected.`,
    patientBody: (c) => `Your referral ${c.no} could not be approved. Open the app to see the reason.`,
    vars: (c) => [c.name, c.no, c.link],
  },
  REFERRAL_FORWARDED: {
    label: "Verified and forwarded",
    to: { cm: [W, A], support: [A], sudo: [A], hospital: [W, E, A], patient: [W, E, A] },
    template: "susali_referral_forwarded",
    title: (c) => `Referral ${c.no} forwarded to ${c.hospital}`,
    body: (c) => `Referral ${c.no} for ${c.name} (${c.company}) has been verified and forwarded to ${c.hospital}.`,
    hospitalBody: (c) => `A new verified referral ${c.no} has been forwarded to ${c.hospital}. Please log in to accept or decline it.`,
    patientBody: (c) => `Your referral ${c.no} is verified. Please visit ${c.hospital}, ${c.hospitalAddress}. Carry your referral letter and ID card.`,
    vars: (c) => [c.name, c.no, c.hospital, c.hospitalAddress, c.link],
  },
  HOSPITAL_DECLINED: {
    label: "Hospital declined",
    to: { cm: [A], support: [W, E, A], sudo: [W, E, A], patient: [A] },
    template: "susali_hospital_declined",
    title: (c) => `${c.hospital} declined ${c.no}`,
    body: (c) => `${c.hospital} declined referral ${c.no} for ${c.name}. It is back in the Verification Queue for re-routing.`,
    patientBody: (c) => `The hospital could not take referral ${c.no}. Our team will forward it to another hospital.`,
    vars: (c) => [c.hospital, c.no, c.name, c.link],
  },
  HOSPITAL_ACCEPTED: {
    label: "Hospital accepted",
    to: { cm: [A], support: [A], patient: [W, A] },
    template: "susali_hospital_accepted",
    title: (c) => `${c.hospital} accepted ${c.no}`,
    body: (c) => `${c.hospital} accepted referral ${c.no} for ${c.name}.`,
    patientBody: (c) => `${c.hospital} has accepted your referral ${c.no} and is expecting you.`,
    vars: (c) => [c.name, c.no, c.hospital, c.link],
  },
  PATIENT_VISITED: {
    label: "Patient visited hospital",
    to: { cm: [W, E, A], support: [W, E, A], sudo: [W, E, A], super: [A] },
    template: "susali_patient_visited",
    title: (c) => `${c.name} visited ${c.hospital}`,
    body: (c) => `SUSALI Alert: Patient ${c.name} (Emp ID ${c.empCode}, ${c.company}) has visited ${c.hospital} for referral ${c.no} on ${c.when}.`,
    vars: (c) => [c.name, c.empCode, c.company, c.hospital, c.no, c.when, c.link],
  },
  CASE_COMPLETED: {
    label: "Case completed, reports uploaded",
    to: { cm: [W, A], support: [A], sudo: [A], patient: [W, E, A] },
    template: "susali_case_completed",
    title: (c) => `Referral ${c.no} completed`,
    body: (c) => `Treatment for referral ${c.no} (${c.name}) at ${c.hospital} is complete.`,
    patientBody: (c) => `Your reports for referral ${c.no} are ready. Open My Records in the SUSALI app to view them.`,
    vars: (c) => [c.name, c.no, c.hospital, c.link],
  },
  ESCALATION: {
    label: "Referral pending past limit",
    to: { support: [W, A], sudo: [W, E, A], super: [E, A] },
    template: "susali_escalation",
    title: (c) => `Escalation: ${c.no} pending`,
    body: (c) => `Referral ${c.no} (${c.name}) has been ${c.stageText} longer than the allowed ${c.limitText}. Current status: ${c.status}.`,
    vars: (c) => [c.no, c.status, c.limitText, c.link],
  },
};

Object.assign(EVENTS, {
  EMPLOYEE_REGISTERED: {
    label: "Employee self-registered",
    to: { cm: [W, A], patient: [W] },
    template: "susali_registration_received",
    title: (c) => `New registration: ${c.name}`,
    body: (c) => `${c.name} (Emp ID ${c.empCode}) registered on SUSALI for ${c.company} and is waiting for your approval.`,
    patientBody: (c) => `Hi ${c.name}, we received your SUSALI registration for ${c.company}. Your Cluster Manager will approve it shortly.`,
    vars: (c) => [c.name, c.empCode, c.company, c.link],
  },
  EMPLOYEE_APPROVED: {
    label: "Registration approved",
    to: { patient: [W, A] },
    template: "susali_registration_approved",
    title: () => "Your SUSALI account is approved",
    body: (c) => `Hi ${c.name}, your registration for ${c.company} is approved. You can now raise hospital referrals in the SUSALI app.`,
    vars: (c) => [c.name, c.company, c.patientLink],
  },
  EMPLOYEE_REJECTED: {
    label: "Registration not approved",
    to: { patient: [W, A] },
    template: "susali_registration_rejected",
    title: () => "SUSALI registration not approved",
    body: (c) => `Hi ${c.name}, your SUSALI registration for ${c.company} could not be approved. Please contact your HR or Cluster Manager.`,
    vars: (c) => [c.name, c.company],
  },
});

export const EVENT_KEYS = Object.keys(EVENTS);

const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

async function context(referral, extra = {}) {
  const r = referral.employee && referral.hospital !== undefined
    ? referral
    : await prisma.referral.findUnique({ where: { id: referral.id }, include: { employee: true, hospital: true } });
  const company = await prisma.company.findUnique({ where: { id: r.companyId }, select: { name: true } });
  const snap = r.patientSnapshot || {};
  return {
    r,
    no: r.referralNo,
    name: patientOf(r).relation === "Self" ? patientOf(r).name : `${patientOf(r).name} (${patientOf(r).relation} of ${r.employee?.fullName || snap.name})`,
    empCode: snap.employeeCode || r.employee?.employeeCode,
    company: company?.name || "",
    hospital: r.hospital?.name || "the hospital",
    hospitalAddress: r.hospital ? `${r.hospital.address}, ${r.hospital.city}` : "",
    status: STATUS[r.status]?.label || r.status,
    when: fmtDateTime(new Date()),
    link: appUrl() + "/login",
    patientLink: appUrl() + "/login",
    ...extra,
  };
}

async function recipientsFor(group, r) {
  const active = { isActive: true };
  switch (group) {
    case "cm":
      return prisma.user.findMany({ where: { ...active, role: "CLUSTER_MANAGER", clusterIds: { has: r.clusterId } } });
    case "support":
      return prisma.user.findMany({ where: { ...active, role: "SUPPORT" } });
    case "sudo":
      return prisma.user.findMany({ where: { ...active, role: "SUDO_ADMIN" } });
    case "super":
      return prisma.user.findMany({ where: { ...active, role: "SUPER_ADMIN" } });
    case "hospital":
      return r.hospitalId
        ? prisma.user.findMany({ where: { ...active, role: "HOSPITAL_USER", hospitalId: r.hospitalId } })
        : [];
    default:
      return [];
  }
}

// Writes Notification rows first; a worker sends them, so pages never wait.
export async function notify(event, { referral, employee, extra } = {}) {
  const def = EVENTS[event];
  if (!def) throw new Error("Unknown event " + event);
  const overrides = (await getTemplateOverrides())[event] || {};
  const templateName = overrides.whatsappTemplate || def.template;

  let c;
  if (referral) c = await context(referral, extra);
  else {
    const company = employee.company || (await prisma.company.findUnique({ where: { id: employee.companyId } }));
    c = { name: employee.fullName, empCode: employee.employeeCode, company: company?.name || "", patientLink: appUrl() + "/login", link: appUrl() + "/login", ...extra };
    c.scope = { clusterId: company?.clusterId };
  }
  const rows = [];
  const add = (row) => rows.push({ event, referralId: referral?.id || null, templateName, ...row });

  for (const [group, channels] of Object.entries(def.to)) {
    if (group === "patient") {
      const emp = employee || c.r?.employee;
      if (!emp) continue;
      const title = def.title(c);
      const body = (def.patientBody || def.body)(c);
      const link = appUrl() + "/login";
      for (const ch of channels) {
        if (ch === E && !emp.email) continue;
        add({
          channel: ch,
          employeeId: emp.id,
          recipient: ch === E ? emp.email : emp.mobile,
          title: overrides.emailSubject && ch === E ? fill(overrides.emailSubject, c) : title,
          body,
          payload: { vars: def.vars({ ...c, link }), link },
          status: ch === A ? "SENT" : "QUEUED",
        });
      }
      continue;
    }
    const users = await recipientsFor(group, c.r || c.scope || {});
    const body = group === "hospital" && def.hospitalBody ? def.hospitalBody(c) : def.body(c);
    const title = def.title(c);
    for (const u of users) {
      for (const ch of channels) {
        if (ch === W && u.muteWhatsapp) continue;
        if (ch === E && u.muteEmail) continue;
        const link = appUrl() + homeFor(u.role) + (c.r ? `/referrals/${c.r.id}` : extra?.path || "");
        add({
          channel: ch,
          userId: u.id,
          recipient: ch === E ? u.email : ch === W ? u.mobile : u.id,
          title: overrides.emailSubject && ch === E ? fill(overrides.emailSubject, c) : title,
          body,
          payload: { vars: def.vars({ ...c, link }), link },
          status: ch === A ? "SENT" : "QUEUED",
        });
      }
    }
    // The hospital's official email also gets forwarded/declined alerts.
    if (group === "hospital" && channels.includes(E) && c.r?.hospital?.email) {
      add({
        channel: E,
        recipient: c.r.hospital.email,
        title,
        body,
        payload: { vars: def.vars(c), link: appUrl() + "/login" },
        status: "QUEUED",
      });
    }
  }

  // Avoid duplicate in-app rows when one person is in two groups.
  const seen = new Set();
  const unique = rows.filter((r) => {
    const k = `${r.channel}|${r.userId || r.employeeId || r.recipient}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (unique.length) await prisma.notification.createMany({ data: unique });
  kickQueue();
  return unique.length;
}

function fill(text, c) {
  return String(text).replace(/\{\{(\w+)\}\}/g, (_, k) => c[k] ?? "");
}

// Process the queue after the response is sent (falls back to fire-and-forget
// outside a request, for example in scripts).
export function kickQueue() {
  try {
    after(() => processQueue().catch((e) => console.error("queue", e)));
  } catch {
    processQueue().catch((e) => console.error("queue", e));
  }
}

const RETRY_MINUTES = [1, 5, 15];

export async function sendOne(n) {
  if (n.channel === "WHATSAPP" || n.channel === "SMS") {
    return msg91SendWhatsApp({ to: n.recipient, templateName: n.templateName, variables: n.payload?.vars || [] });
  }
  if (n.channel === "EMAIL") {
    return sendEmail({
      to: n.recipient,
      subject: `SUSALI: ${n.title}`,
      text: n.body + (n.payload?.link ? `\n\n${n.payload.link}` : ""),
      html: emailHtml({ title: n.title, body: n.body, link: n.payload?.link, rows: n.payload?.rows }),
    });
  }
  return "in-app";
}

export async function processQueue(limit = 50) {
  const now = new Date();
  const due = await prisma.notification.findMany({
    where: { status: "QUEUED", nextTryAt: { lte: now }, channel: { in: ["WHATSAPP", "EMAIL", "SMS"] } },
    orderBy: { nextTryAt: "asc" },
    take: limit,
  });
  let sent = 0, failed = 0;
  for (const n of due) {
    // Claim the row so two workers never send the same message.
    const claim = await prisma.notification.updateMany({
      where: { id: n.id, status: "QUEUED", attempts: n.attempts },
      data: { attempts: { increment: 1 }, nextTryAt: new Date(Date.now() + 2 * 60 * 1000) },
    });
    if (claim.count !== 1) continue;
    const attempt = n.attempts + 1;
    try {
      const ref = await sendOne(n);
      await prisma.notification.update({ where: { id: n.id }, data: { status: "SENT", providerRef: String(ref), error: null } });
      sent++;
    } catch (e) {
      const retryIn = RETRY_MINUTES[attempt - 1];
      await prisma.notification.update({
        where: { id: n.id },
        data: retryIn
          ? { error: String(e.message || e).slice(0, 500), nextTryAt: new Date(Date.now() + retryIn * 60 * 1000) }
          : { status: "FAILED", error: String(e.message || e).slice(0, 500) },
      });
      failed++;
    }
  }
  return { processed: due.length, sent, failed };
}

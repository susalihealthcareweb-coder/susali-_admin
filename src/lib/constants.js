// Shared labels and lookups used by both server and client code.

export const ROLES = {
  SUPER_ADMIN: { label: "Super Admin", slug: "super-admin" },
  SUDO_ADMIN: { label: "Sudo Admin", slug: "sudo-admin" },
  SUPPORT: { label: "Support Team", slug: "support" },
  CLUSTER_MANAGER: { label: "Cluster Manager", slug: "cluster-manager" },
  HOSPITAL_USER: { label: "Hospital User", slug: "hospital" },
  PATIENT: { label: "Patient", slug: "patient" },
};

export const STAFF_ROLES = ["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "CLUSTER_MANAGER", "HOSPITAL_USER"];
export const ADMIN_ROLES = ["SUPER_ADMIN", "SUDO_ADMIN"];
export const VERIFIER_ROLES = ["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT"];

export function roleFromSlug(slug) {
  return Object.keys(ROLES).find((r) => ROLES[r].slug === slug) || null;
}
export function homeFor(role) {
  return "/" + (ROLES[role]?.slug || "login");
}

export const STATUS = {
  DRAFT: { label: "Draft", tone: "slate" },
  SUBMITTED: { label: "Submitted", tone: "blue" },
  UNDER_VERIFICATION: { label: "Under Verification", tone: "indigo" },
  INFO_REQUESTED: { label: "Information Requested", tone: "amber" },
  REJECTED: { label: "Rejected", tone: "red" },
  FORWARDED: { label: "Forwarded to Hospital", tone: "violet" },
  HOSPITAL_DECLINED: { label: "Hospital Declined", tone: "orange" },
  ACCEPTED: { label: "Accepted by Hospital", tone: "cyan" },
  VISITED: { label: "Patient Visited", tone: "teal" },
  UNDER_TREATMENT: { label: "Under Treatment", tone: "sky" },
  COMPLETED: { label: "Completed", tone: "green" },
  CLOSED: { label: "Closed", tone: "gray" },
  CANCELLED: { label: "Cancelled", tone: "stone" },
};

// Order used for the pipeline and the patient progress bar.
export const PIPELINE = [
  "SUBMITTED",
  "UNDER_VERIFICATION",
  "FORWARDED",
  "ACCEPTED",
  "VISITED",
  "UNDER_TREATMENT",
  "COMPLETED",
  "CLOSED",
];
export const PATIENT_STAGES = [
  { key: "SUBMITTED", label: "Submitted" },
  { key: "VERIFIED", label: "Verified" },
  { key: "ACCEPTED", label: "Hospital accepted" },
  { key: "VISITED", label: "Visited" },
  { key: "COMPLETED", label: "Reports ready" },
];
export function patientStageIndex(status) {
  switch (status) {
    case "DRAFT": return -1;
    case "SUBMITTED": case "UNDER_VERIFICATION": case "INFO_REQUESTED": case "HOSPITAL_DECLINED": return 0;
    case "FORWARDED": return 1;
    case "ACCEPTED": return 2;
    case "VISITED": case "UNDER_TREATMENT": return 3;
    case "COMPLETED": case "CLOSED": return 4;
    default: return -1;
  }
}

export const OPEN_STATUSES = [
  "SUBMITTED", "UNDER_VERIFICATION", "INFO_REQUESTED", "FORWARDED",
  "HOSPITAL_DECLINED", "ACCEPTED", "VISITED", "UNDER_TREATMENT",
];
export const HOSPITAL_VISIBLE = ["FORWARDED", "ACCEPTED", "VISITED", "UNDER_TREATMENT", "COMPLETED", "CLOSED"];
export const QUEUE_STATUSES = ["SUBMITTED", "HOSPITAL_DECLINED"];

export const URGENCY = {
  ROUTINE: { label: "Routine", tone: "slate", rank: 2 },
  URGENT: { label: "Urgent", tone: "amber", rank: 1 },
  EMERGENCY: { label: "Emergency", tone: "red", rank: 0 },
};

export const DOC_CATEGORIES = {
  REFERRAL_LETTER: "Referral letter",
  PREVIOUS_REPORT: "Earlier report",
  PRESCRIPTION: "Prescription",
  LAB_REPORT: "Lab report",
  SCAN: "Scan / Imaging",
  DISCHARGE_SUMMARY: "Discharge summary",
  OTHER: "Other",
};
export const PATIENT_DOC_CATEGORIES = ["REFERRAL_LETTER", "PREVIOUS_REPORT"];
export const HOSPITAL_DOC_CATEGORIES = ["PRESCRIPTION", "LAB_REPORT", "SCAN", "DISCHARGE_SUMMARY", "OTHER"];

export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "application/zip", "application/x-zip-compressed"];

export const REJECT_REASONS = ["Invalid letter", "Inactive employee", "Duplicate", "Not eligible", "Other"];
export const DECLINE_REASONS = ["No bed", "No specialist", "Other"];
export const GENDERS = ["Male", "Female", "Other"];
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const RELATIONS = ["Spouse", "Son", "Daughter", "Father", "Mother", "Father-in-law", "Mother-in-law", "Brother", "Sister", "Other"];

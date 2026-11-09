// All dates are stored in UTC and shown in IST.
const TZ = "Asia/Kolkata";

export function fmtDate(d) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}
export function fmtDateTime(d) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}
export function toInputDate(d) {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d));
}
export function fmtBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}
export function fmtHours(h) {
  if (h == null || Number.isNaN(h)) return "—";
  if (h < 1) return Math.round(h * 60) + " min";
  if (h < 48) return h.toFixed(1) + " h";
  return (h / 24).toFixed(1) + " days";
}
export function ageFrom(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}
export function normalizeMobile(m) {
  const digits = String(m || "").replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
}

// Who a referral is for: the employee ("Self") or a family member.
export function patientOf(r) {
  const s = r?.patientSnapshot || {};
  return {
    name: r?.patientName || s.patient?.name || s.name || r?.employee?.fullName || "",
    relation: r?.patientRelation || s.patient?.relation || "Self",
  };
}

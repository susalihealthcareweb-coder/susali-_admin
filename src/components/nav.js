// Navigation per role. `mobile` items appear in the bottom bar on phones.
export function navFor(role, base) {
  const L = (label, path, icon, mobile) => ({ label, href: base + path, icon, mobile });
  const approvals = L("Approvals", "/registrations", "userCheck");
  switch (role) {
    case "SUPER_ADMIN":
      return [L("Dashboard", "", "home", 1), L("Verification Queue", "/queue", "queue", 1), L("Referrals", "/referrals", "referral", 1), L("Companies", "/companies", "building"), approvals, L("Masters", "/masters", "database"), L("Users", "/users", "users"), L("Message health", "/messages", "message"), L("Reports", "/reports", "chart"), L("Audit log", "/audit", "shield"), L("Settings", "/settings", "settings"), L("Alerts", "/notifications", "bell", 1)];
    case "SUDO_ADMIN":
      return [L("Dashboard", "", "home", 1), L("Verification Queue", "/queue", "queue", 1), L("Referrals", "/referrals", "referral", 1), L("Companies", "/companies", "building"), approvals, L("Masters", "/masters", "database"), L("Users", "/users", "users"), L("Reports", "/reports", "chart"), L("Audit log", "/audit", "shield"), L("Alerts", "/notifications", "bell", 1)];
    case "SUPPORT":
      return [L("Dashboard", "", "home", 1), L("Verification Queue", "/queue", "queue", 1), L("Referrals", "/referrals", "referral", 1), L("Companies", "/companies", "building"), L("Reports", "/reports", "chart"), L("Alerts", "/notifications", "bell", 1)];
    case "CLUSTER_MANAGER":
      return [L("Home", "", "home", 1), L("Companies", "/companies", "building", 1), { ...approvals, mobile: 1 }, L("Referrals", "/referrals", "referral", 1), L("Alerts", "/notifications", "bell", 1)];
    case "HOSPITAL_USER":
      return [L("Dashboard", "", "home", 1), L("Referrals", "/referrals", "referral", 1), L("Reports", "/reports", "chart", 1), L("Alerts", "/notifications", "bell", 1)];
    default:
      return [];
  }
}

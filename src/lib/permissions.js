// Role x action map from section 6 of the spec.
// "own" means the server must also check scope (cluster, hospital or patient).

const P = {
  // Super Admin: everything, including delete. Sudo Admin: everything except
  // delete / deactivate. Support: verification. Cluster Manager: employees and
  // referrals on their behalf. Hospital: its own referrals and reports.
  manageSudoAdmins: { SUPER_ADMIN: true },
  manageStaffUsers: { SUPER_ADMIN: true, SUDO_ADMIN: true },
  manageMasters: { SUPER_ADMIN: true, SUDO_ADMIN: true },
  viewMasters: { SUPER_ADMIN: true, SUDO_ADMIN: true, SUPPORT: true, CLUSTER_MANAGER: true },
  deleteRecords: { SUPER_ADMIN: true },
  deactivateRecords: { SUPER_ADMIN: true },
  addCompanies: { SUPER_ADMIN: true, SUDO_ADMIN: true },
  viewCompanies: { SUPER_ADMIN: true, SUDO_ADMIN: true, SUPPORT: true, CLUSTER_MANAGER: "own" },
  moveCompanyCluster: { SUPER_ADMIN: true, SUDO_ADMIN: true },
  editEmployees: { SUPER_ADMIN: true, SUDO_ADMIN: true, CLUSTER_MANAGER: "own" },
  approveRegistrations: { SUPER_ADMIN: true, SUDO_ADMIN: true, CLUSTER_MANAGER: "own" },
  createReferral: { PATIENT: "own", CLUSTER_MANAGER: "own" },
  overrideReferral: { SUPER_ADMIN: true },
  cancelReferral: { SUPER_ADMIN: true, SUDO_ADMIN: true, SUPPORT: true, PATIENT: "own", CLUSTER_MANAGER: "own" },
  verifyReferral: { SUPER_ADMIN: true, SUDO_ADMIN: true, SUPPORT: true },
  hospitalHandle: { HOSPITAL_USER: "own" },
  uploadMedical: { HOSPITAL_USER: "own" },
  viewDocuments: { SUPER_ADMIN: true, SUDO_ADMIN: true, SUPPORT: true, HOSPITAL_USER: "own", PATIENT: "own" },
  viewReferrals: { SUPER_ADMIN: true, SUDO_ADMIN: true, SUPPORT: true, CLUSTER_MANAGER: "own", HOSPITAL_USER: "own", PATIENT: "own" },
  reopenReferral: { SUPER_ADMIN: true, SUDO_ADMIN: true },
  reports: { SUPER_ADMIN: true, SUDO_ADMIN: true, SUPPORT: true, HOSPITAL_USER: "own" },
  auditLog: { SUPER_ADMIN: true, SUDO_ADMIN: true },
  settings: { SUPER_ADMIN: true },
};

export function can(role, action) {
  return Boolean(P[action]?.[role]);
}

// Sudo Admins can add and edit, but only the Super Admin can deactivate or
// reactivate users, masters, companies and employees.
export function canToggleActive(role) {
  return role !== "SUDO_ADMIN";
}

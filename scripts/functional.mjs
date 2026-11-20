// Functional tests for the features the workflow tests (e2e.mjs, api-check.mjs)
// do not reach: settings, staff users, companies, bulk employee upload, family
// edits by staff, patient profile, alerts, message retry, daily summary job,
// self-registration through the app, account deletion and data erasure.
// Run through the safe runner: npm run test:e2e   (uses the susali_test database)
const BASE = process.argv[2] || "http://localhost:3200";
const OTP = process.env.DEV_OTP || "123456";
const CRON = process.env.CRON_SECRET;
let fails = 0;
const check = (label, ok, info) => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : "  → " + String(JSON.stringify(info)).slice(0, 260)}`); };
const rnd = () => String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
const newMobile = () => "7" + rnd();

async function call(token, path, { method = "GET", data, form, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(data ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: form || (data ? JSON.stringify(data) : undefined),
  });
  const type = res.headers.get("content-type") || "";
  if (!type.includes("json")) return { status: res.status, type, bytes: (await res.arrayBuffer()).byteLength };
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
}
const login = async (email, password = "Demo@1234") => (await call(null, "/api/mobile/auth/login", { method: "POST", data: { email, password } }));
async function patientLogin(mobile) {
  await call(null, "/api/auth/otp/send", { method: "POST", data: { mobile } });
  return call(null, "/api/mobile/auth/otp", { method: "POST", data: { mobile, otp: OTP } });
}

const su = (await login("admin@susali.in", process.env.SEED_ADMIN_PASSWORD || "ChangeMe@123")).token;
const sudo = (await login("sudo@susali.in")).token;
const sp = (await login("support@susali.in")).token;
const cm = (await login("cm@susali.in")).token;
check("all staff signed in", su && sudo && sp && cm);

// ---------- Settings (Super Admin only) ----------
check("Support cannot open settings", (await call(sp, "/api/admin/settings")).status === 403);
const st = await call(su, "/api/admin/settings");
check("Super Admin reads settings and message templates", st.settings?.maxFileMb > 0 && Object.keys(st.templates || {}).length > 5, st);
const changed = { ...st.settings, maxFileMb: st.settings.maxFileMb === 20 ? 21 : 20 };
check("Super Admin changes a setting", (await call(su, "/api/admin/settings", { method: "PUT", data: { settings: changed } })).status === 200);
check("the change is saved", (await call(su, "/api/admin/settings")).settings?.maxFileMb === changed.maxFileMb);
check("an out-of-range setting is refused", (await call(su, "/api/admin/settings", { method: "PUT", data: { settings: { ...st.settings, maxFileMb: 500 } } })).status === 400);
check("Sudo Admin cannot change settings", (await call(sudo, "/api/admin/settings", { method: "PUT", data: { settings: st.settings } })).status === 403);
await call(su, "/api/admin/settings", { method: "PUT", data: { settings: st.settings } });

// ---------- Staff users ----------
const email = `qa-${rnd()}@susali.test`;
let r = await call(su, "/api/admin/users", { method: "POST", data: { name: "QA Support", email, mobile: newMobile(), role: "SUPPORT", password: "QaTest@123" } });
check("Super Admin creates a Support user", r.status === 201 && r.user?.id, r);
const qaId = r.user?.id;
check("the new user can sign in", (await login(email, "QaTest@123")).me?.role === "SUPPORT");
check("Sudo Admin cannot create a Super Admin", (await call(sudo, "/api/admin/users", { method: "POST", data: { name: "QA Boss", email: `qa-${rnd()}@susali.test`, mobile: newMobile(), role: "SUPER_ADMIN", password: "QaTest@123" } })).status === 403);
check("Support cannot create users", (await call(sp, "/api/admin/users", { method: "POST", data: { name: "QA", email: `qa-${rnd()}@susali.test`, mobile: newMobile(), role: "SUPPORT", password: "QaTest@123" } })).status === 403);
check("a duplicate email is refused", (await call(su, "/api/admin/users", { method: "POST", data: { name: "QA Dup", email, mobile: newMobile(), role: "SUPPORT", password: "QaTest@123" } })).status >= 400);
check("Sudo Admin renames the user", (await call(sudo, `/api/admin/users/${qaId}`, { method: "PATCH", data: { name: "QA Support Renamed" } })).user?.name === "QA Support Renamed");
check("Sudo Admin cannot deactivate users", (await call(sudo, `/api/admin/users/${qaId}`, { method: "PATCH", data: { isActive: false } })).status === 403);
check("Super Admin resets the password", (await call(su, `/api/admin/users/${qaId}`, { method: "PATCH", data: { password: "QaTest@456" } })).status === 200);
check("old password no longer works", (await login(email, "QaTest@123")).status === 401);
check("new password works", (await login(email, "QaTest@456")).me?.role === "SUPPORT");
check("Super Admin deactivates the user", (await call(su, `/api/admin/users/${qaId}`, { method: "PATCH", data: { isActive: false } })).user?.isActive === false);
check("a deactivated user cannot sign in", (await login(email, "QaTest@456")).status === 401);
check("Super Admin cannot erase themselves", (await call(su, `/api/admin/users/${(await call(su, "/api/me")).me?.id}/erase`, { method: "POST", data: {} })).status === 400);
check("Super Admin erases the user's personal data", (await call(su, `/api/admin/users/${qaId}/erase`, { method: "POST", data: {} })).status === 200);

// ---------- Companies ----------
const clusters = (await call(su, "/api/admin/clusters?active=1")).rows || [];
r = await call(su, "/api/companies", { method: "POST", data: { name: `QA Industries ${rnd()}`, address: "1 Test Road", city: "Hyderabad", state: "Telangana", pincode: "500001", clusterId: clusters[0]?.id } });
check("Super Admin adds a company", r.status === 201 && r.company?.id, r);
const coId = r.company?.id;
check("the company gets a SUSALI code", /^SUS-CMP-\d{4}$/.test(r.company?.code || ""), r.company?.code);
check("a bad PIN code is refused", (await call(su, "/api/companies", { method: "POST", data: { name: "QA Bad", address: "1 Test Road", city: "Hyderabad", state: "Telangana", pincode: "12" } })).status === 400);
check("Super Admin edits the company", (await call(su, `/api/companies/${coId}`, { method: "PATCH", data: { name: r.company?.name, address: "2 Test Road", city: "Secunderabad", state: "Telangana", pincode: "500003", clusterId: clusters[0]?.id } })).company?.city === "Secunderabad");
check("Support cannot edit companies", (await call(sp, `/api/companies/${coId}`, { method: "PATCH", data: { city: "X" } })).status === 403);
check("Cluster Manager cannot add companies", (await call(cm, "/api/companies", { method: "POST", data: { name: "QA CM Co", address: "1 Road", city: "Hyderabad", state: "Telangana", pincode: "500001" } })).status === 403);

// ---------- Bulk employee upload ----------
const cmCompanies = (await call(cm, "/api/companies")).rows || [];
const cmCo = cmCompanies.find((c) => c.isActive);
const tpl = await call(cm, `/api/companies/${cmCo.id}/employees/template`);
check("Cluster Manager downloads the Excel template", tpl.status === 200 && tpl.type.includes("spreadsheet") && tpl.bytes > 1000, tpl);
const goodMobile = newMobile();
const code = `QA${rnd().slice(0, 6)}`;
const csv = `Employee ID,Full Name,Gender (Male/Female/Other),Date of Birth (YYYY-MM-DD),Mobile,Email,Aadhaar Last 4,Department,Designation,Blood Group,Address,Emergency Contact Name,Emergency Contact Mobile
${code},QA Bulk Person,Female,1992-05-10,${goodMobile},,1234,Stores,Clerk,O+,Hyderabad,,
${code}X,QA Bad Row,Female,1992-05-10,12345,,,,,,,,`;
const form = new FormData();
form.append("file", new Blob([csv], { type: "text/csv" }), "employees.csv");
r = await call(cm, `/api/companies/${cmCo.id}/employees/bulk`, { method: "POST", form });
check("bulk upload saves the good row and rejects the bad one", r.saved === 1 && r.rejected === 1 && r.errors?.length === 1, r);
const found = (await call(cm, `/api/employees?q=${goodMobile}`)).rows?.[0];
check("the uploaded employee can be found", found?.fullName === "QA Bulk Person", found);
check("Support cannot bulk upload", (await call(sp, `/api/companies/${cmCo.id}/employees/bulk`, { method: "POST", form })).status === 403);

// ---------- Employee and family edits by staff ----------
r = await call(cm, `/api/employees/${found.id}`, { method: "PATCH", data: { designation: "Senior Clerk" } });
check("Cluster Manager edits the employee", r.status === 200, r);
check("Support cannot edit employees", (await call(sp, `/api/employees/${found.id}`, { method: "PATCH", data: { designation: "X" } })).status === 403);
r = await call(cm, `/api/employees/${found.id}/family`, { method: "POST", data: { fullName: "QA Child", relation: "Son", gender: "Male", dateOfBirth: "2015-01-01" } });
check("Cluster Manager adds a family member", r.status === 201, r);
const fid = r.member?.id;
check("Cluster Manager edits the family member", (await call(cm, `/api/employees/${found.id}/family/${fid}`, { method: "PATCH", data: { fullName: "QA Child Renamed" } })).member?.fullName === "QA Child Renamed");
check("Sudo Admin cannot remove family members", (await call(sudo, `/api/employees/${found.id}/family/${fid}`, { method: "DELETE" })).status === 403);
check("Cluster Manager removes the family member", (await call(cm, `/api/employees/${found.id}/family/${fid}`, { method: "DELETE" })).status === 200);
check("removed member no longer listed", !((await call(cm, `/api/employees/${found.id}/family`)).rows || []).some((m) => m.id === fid));

// ---------- Patient profile and alerts ----------
const pt = (await patientLogin("9010561998")).token;
check("patient signs in", Boolean(pt));
r = await call(pt, "/api/patient/profile", { method: "PATCH", data: { address: "Kukatpally, Hyderabad (QA)", emergencyName: "Srinivas Prasad", emergencyMobile: "9876500002" } });
check("patient updates their profile", r.status === 200, r);
check("the change shows on the profile", (await call(pt, "/api/me")).me?.address === "Kukatpally, Hyderabad (QA)");
check("an invalid email is refused", (await call(pt, "/api/patient/profile", { method: "PATCH", data: { email: "not-an-email" } })).status === 400);
await call(pt, "/api/patient/profile", { method: "PATCH", data: { address: "Kukatpally, Hyderabad" } });
const alerts = (await call(pt, "/api/notifications")).rows || [];
check("patient has alerts", alerts.length > 0, alerts.length);
const unread = alerts.find((n) => !n.isRead);
if (unread) check("patient marks one alert read", (await call(pt, `/api/notifications/${unread.id}/read`, { method: "PATCH" })).status === 200);
check("patient marks all alerts read", (await call(pt, "/api/notifications/read-all", { method: "PATCH" })).status === 200);
check("no unread alerts left", !((await call(pt, "/api/notifications")).rows || []).some((n) => !n.isRead));
check("only failed messages can be retried", (await call(su, `/api/notifications/${alerts[0].id}/retry`, { method: "POST" })).status === 409);
check("Support cannot retry messages", (await call(sp, `/api/notifications/${alerts[0].id}/retry`, { method: "POST" })).status === 403);

// ---------- Daily summary job ----------
check("daily summary refuses without the secret", [401, 403].includes((await call(null, "/api/cron/daily-summary")).status));
check("daily summary runs with the secret", (await call(null, "/api/cron/daily-summary", { headers: { Authorization: `Bearer ${CRON}` } })).status === 200);

// ---------- Self-registration in the app, approval, deletion, erasure ----------
const regMobile = newMobile();
check("registration OTP sent to a new number", (await call(null, "/api/auth/register/otp", { method: "POST", data: { mobile: regMobile } })).status === 200);
r = await call(null, "/api/mobile/auth/register", { method: "POST", data: { companyId: cmCo.id, employeeCode: `QR${rnd().slice(0, 6)}`, fullName: "QA App Registrant", gender: "Male", dateOfBirth: "1990-03-15", mobile: regMobile, otp: OTP, consent: true } });
check("employee registers in the app and gets signed in", r.token && r.me?.approvalStatus === "PENDING", r);
const rt = r.token;
const regId = r.me?.id;
check("a pending employee cannot raise a referral", (await call(rt, "/api/referrals", { method: "POST", data: {} })).status === 403);
check("Cluster Manager approves the registration", (await call(cm, `/api/employees/${regId}/approval`, { method: "POST", data: { decision: "APPROVE" } })).status === 200);
check("approved employee now shows as approved", (await call(rt, "/api/me")).me?.approvalStatus === "APPROVED");
r = await call(rt, "/api/me/delete-request", { method: "POST", data: { reason: "QA test" } });
check("employee asks for their account to be deleted", r.status === 200 && r.requestedAt, r);
check("Super Admin is alerted about the deletion request", ((await call(su, "/api/notifications")).rows || []).some((n) => /deletion/i.test(n.title || "")));
check("Sudo Admin cannot erase employee data", (await call(sudo, `/api/employees/${regId}/erase`, { method: "POST", data: {} })).status === 403);
check("Super Admin erases the employee's personal data", (await call(su, `/api/employees/${regId}/erase`, { method: "POST", data: {} })).status === 200);
check("the erased employee is signed out and cannot sign in", (await call(rt, "/api/me")).status === 401 && !(await patientLogin(regMobile)).token);

// ---------- File links ----------
check("a tampered file link is refused", (await call(null, "/api/files?key=referrals/x/y.pdf&exp=9999999999&sig=bad")).status === 403);

console.log(fails ? `\n${fails} FAILED` : "\nAll functional checks passed");
process.exit(fails ? 1 : 0);

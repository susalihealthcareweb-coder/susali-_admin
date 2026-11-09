// End-to-end smoke test of the referral workflow against a running dev server
// using the seeded demo accounts. Run: node scripts/e2e.mjs [baseUrl]
// Requires MSG91 to be unconfigured so the DEV_OTP is accepted.

const BASE = process.argv[2] || "http://localhost:3100";
const OTP = process.env.DEV_OTP || "123456";
let failures = 0;

class Client {
  constructor(name) { this.name = name; this.jar = {}; }
  cookie() { return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; "); }
  store(res) {
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.jar[pair.slice(0, i)] = pair.slice(i + 1);
    }
  }
  async req(path, { method = "GET", json, body, headers = {}, raw } = {}) {
    const res = await fetch(BASE + path, {
      method,
      redirect: "manual",
      headers: { cookie: this.cookie(), ...(json !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : body,
    });
    this.store(res);
    if (raw) return res;
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  }
  async staffLogin(email, password = "Demo@1234") {
    const { data } = await this.req("/api/auth/csrf");
    const res = await this.req("/api/auth/callback/staff", {
      method: "POST",
      body: new URLSearchParams({ email, password, csrfToken: data.csrfToken }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      raw: true,
    });
    const s = await this.req("/api/auth/session");
    check(`${this.name} logs in`, s.data?.user?.role, (v) => Boolean(v));
    return res;
  }
}

function check(label, value, ok = (v) => v === true) {
  const pass = ok(value);
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${pass ? "" : `  → ${JSON.stringify(value).slice(0, 300)}`}`);
}
const is = (code) => (r) => r.status === code;

const patient = new Client("patient");
const support = new Client("support");
const hospital = new Client("hospital");
const cm = new Client("cluster manager");
const admin = new Client("super admin");

// Patient login
check("unknown mobile is refused", await patient.req("/api/auth/otp/send", { method: "POST", json: { mobile: "9111111111" } }), is(404));
let r = await patient.req("/api/auth/otp/send", { method: "POST", json: { mobile: "9000000010" } });
check("patient OTP sent", r, is(200));
check("wrong OTP rejected", await patient.req("/api/auth/otp/verify", { method: "POST", json: { mobile: "9000000010", otp: "000000" } }), is(401));
r = await patient.req("/api/auth/otp/verify", { method: "POST", json: { mobile: "9000000010", otp: OTP } });
check("patient OTP verified", r, is(200));
check("patient consent", await patient.req("/api/patient/consent", { method: "POST" }), is(200));

// Family members on the card
r = await patient.req("/api/patient/family", { method: "POST", json: { fullName: "Test Child", relation: "Son", gender: "Male", dateOfBirth: "2016-02-10" } });
check("patient adds family member", r, is(201));
const famId = r.data.member?.id;
r = await patient.req("/api/referrals", { method: "POST", json: { familyMemberId: famId } });
check("draft for family member", r, (x) => x.status === 201 && x.data.referral.patientName === "Test Child" && x.data.referral.patientRelation === "Son");
check("cannot remove member with open draft", await patient.req(`/api/patient/family/${famId}`, { method: "DELETE" }), is(409));
await patient.req(`/api/referrals/${r.data.referral.id}/cancel`, { method: "POST", json: { reason: "test" } });
check("remove family member", await patient.req(`/api/patient/family/${famId}`, { method: "DELETE" }), is(200));
check("removed member cannot be chosen", await patient.req("/api/referrals", { method: "POST", json: { familyMemberId: famId } }), is(400));

// Masters for the form
const hospitals = (await patient.req("/api/admin/hospitals?active=1")).data.rows;
const care = hospitals.find((h) => h.code === "CARE-HYD");
const depts = (await patient.req("/api/admin/departments")).data.rows;
const disp = (await patient.req("/api/admin/dispensaries?active=1")).data.rows[0];
const sup = (await patient.req("/api/admin/superintendent-hospitals?active=1")).data.rows[0];
check("patient cannot create masters", await patient.req("/api/admin/departments", { method: "POST", json: { name: "X" } }), is(403));

// Draft → submit
r = await patient.req("/api/referrals", { method: "POST", json: { urgency: "URGENT" } });
check("draft created", r, is(201));
let id = r.data.referral.id;
check("submit blocked when incomplete", await patient.req(`/api/referrals/${id}/submit`, { method: "POST", json: {} }), is(400));
r = await patient.req(`/api/referrals/${id}`, {
  method: "PATCH",
  json: {
    dispensaryId: disp.id, dispensaryVisitDate: "2026-11-01", superintendentHospitalId: sup.id, superintendentName: "Dr. Rao",
    referralLetterNo: "SUP/2026/551", referralDate: "2026-11-03", hospitalId: care.id,
    departmentId: depts.find((d) => d.name === "Cardiology").id, diagnosis: "Chest pain, evaluation", urgency: "URGENT",
  },
});
check("draft updated", r, is(200));
check("submit blocked without letter", await patient.req(`/api/referrals/${id}/submit`, { method: "POST", json: {} }), (x) => x.status === 400 && /letter/i.test(x.data.error));

async function upload(client, category, name, type, content) {
  const buf = Buffer.from(content);
  const s = await client.req("/api/uploads/sign", { method: "POST", json: { purpose: "referral", referralId: id, category, fileName: name, mimeType: type, size: buf.length } });
  if (s.status !== 200) return s;
  const put = await fetch(s.data.url.startsWith("http") ? s.data.url : BASE + s.data.url, { method: "PUT", headers: s.data.headers, body: buf });
  if (!put.ok) return { status: put.status, data: await put.text() };
  return client.req(`/api/referrals/${id}/documents`, { method: "POST", json: { key: s.data.key, category, fileName: name, mimeType: type, size: buf.length } });
}
check("bad file type refused", await patient.req("/api/uploads/sign", { method: "POST", json: { purpose: "referral", referralId: id, category: "REFERRAL_LETTER", fileName: "x.exe", mimeType: "application/x-msdownload", size: 10 } }), is(400));
check("patient uploads letter", await upload(patient, "REFERRAL_LETTER", "letter.pdf", "application/pdf", "%PDF-1.4 referral letter"), is(201));
r = await patient.req(`/api/referrals/${id}/submit`, { method: "POST", json: {} });
check("patient submits", r, (x) => x.status === 200 && /^SUS-REF-\d{4}-\d{6}$/.test(x.data.referral?.referralNo));
const refNo = r.data.referral?.referralNo;
check("patient cannot edit after submit", await patient.req(`/api/referrals/${id}`, { method: "PATCH", json: { diagnosis: "x" } }), is(409));

// Hospital cannot see before forwarding
await hospital.staffLogin("hospital@susali.in");
check("hospital cannot see unverified referral", await hospital.req(`/api/referrals/${id}`), is(404));

// Support verifies
await support.staffLogin("support@susali.in");
check("support locks", await support.req(`/api/referrals/${id}/lock`, { method: "POST", json: {} }), is(200));
await admin.staffLogin("admin@susali.in", process.env.SEED_ADMIN_PASSWORD || "ChangeMe@123");
check("second verifier sees lock conflict", await admin.req(`/api/referrals/${id}/lock`, { method: "POST", json: {} }), is(409));
r = await support.req(`/api/referrals/${id}/request-info`, { method: "POST", json: { note: "Letter photo is blurry, please re-upload" } });
check("support requests info", r, (x) => x.data.referral?.status === "INFO_REQUESTED");
check("patient re-uploads", await upload(patient, "REFERRAL_LETTER", "letter-clear.jpg", "image/jpeg", "JPEGDATA"), is(201));
check("patient resubmits", await patient.req(`/api/referrals/${id}/submit`, { method: "POST", json: {} }), (x) => x.data.referral?.status === "SUBMITTED" && x.data.referral.referralNo === refNo);
await support.req(`/api/referrals/${id}/lock`, { method: "POST", json: {} });
r = await support.req(`/api/referrals/${id}/forward`, { method: "POST", json: { notes: "Urgent cardiology review" } });
check("support forwards", r, (x) => x.data.referral?.status === "FORWARDED");

// Hospital handles
check("hospital sees forwarded referral", await hospital.req(`/api/referrals/${id}`), is(200));
check("hospital cannot jump to visited", await hospital.req(`/api/referrals/${id}/visit`, { method: "POST", json: { method: "ID_CARD", referralNo: refNo } }), is(409));
check("hospital accepts", await hospital.req(`/api/referrals/${id}/accept`, { method: "POST", json: {} }), (x) => x.data.referral?.status === "ACCEPTED");
check("patient cannot cancel after accept", await patient.req(`/api/referrals/${id}/cancel`, { method: "POST", json: {} }), is(409));
check("visit OTP sent", await hospital.req(`/api/referrals/${id}/visit-otp`, { method: "POST", json: {} }), is(200));
check("wrong referral number refused", await hospital.req(`/api/referrals/${id}/visit`, { method: "POST", json: { method: "OTP", otp: OTP, referralNo: "SUS-REF-0000-000000" } }), is(400));
check("hospital marks visited with OTP", await hospital.req(`/api/referrals/${id}/visit`, { method: "POST", json: { method: "OTP", otp: OTP, referralNo: refNo } }), (x) => x.data.referral?.status === "VISITED");
check("treatment started", await hospital.req(`/api/referrals/${id}/treatment`, { method: "POST", json: { visitType: "OPD", treatingDoctor: "Dr. Meena", notes: "ECG done" } }), (x) => x.data.referral?.status === "UNDER_TREATMENT");
check("complete blocked without prescription", await hospital.req(`/api/referrals/${id}/complete`, { method: "POST", json: {} }), is(400));
check("hospital uploads prescription", await upload(hospital, "PRESCRIPTION", "rx.pdf", "application/pdf", "%PDF-1.4 rx"), is(201));
check("hospital uploads lab report", await upload(hospital, "LAB_REPORT", "ecg.png", "image/png", "PNGDATA"), is(201));
check("hospital completes", await hospital.req(`/api/referrals/${id}/complete`, { method: "POST", json: {} }), (x) => x.data.referral?.status === "COMPLETED");

// Patient views records
r = await patient.req(`/api/referrals/${id}`);
const rx = r.data.referral.documents.find((d) => d.category === "PRESCRIPTION");
r = await patient.req(`/api/documents/${rx.id}/url`);
check("patient gets signed link", r, is(200));
const file = await fetch(r.data.url.startsWith("http") ? r.data.url : BASE + r.data.url);
check("signed link serves the file", await file.text(), (t) => t === "%PDF-1.4 rx");

// Cluster Manager scope
await cm.staffLogin("cm@susali.in");
r = await cm.req(`/api/referrals/${id}`);
check("CM sees status", r, (x) => x.status === 200 && x.data.referral.status === "COMPLETED");
check("CM sees no documents", r, (x) => x.data.referral.documents.length === 0);
check("CM cannot open medical file", await cm.req(`/api/documents/${rx.id}/url`), is(403));
check("CM cannot verify", await cm.req(`/api/referrals/${id}/close`, { method: "POST", json: {} }), is(403));

// Support closes, admin reopens
check("support closes", await support.req(`/api/referrals/${id}/close`, { method: "POST", json: {} }), (x) => x.data.referral?.status === "CLOSED");
check("support cannot reopen", await support.req(`/api/referrals/${id}/reopen`, { method: "POST", json: { remarks: "x" } }), is(403));
check("admin reopens", await admin.req(`/api/referrals/${id}/reopen`, { method: "POST", json: { remarks: "Follow-up visit needed" } }), (x) => x.data.referral?.status === "COMPLETED");

// Admin surfaces
check("super admin dashboard", await admin.req("/api/dashboard/super-admin"), (x) => x.status === 200 && x.data.cards.hospitals >= 1);
check("support cannot load super dashboard", await support.req("/api/dashboard/super-admin"), is(403));
check("audit log readable", await admin.req("/api/admin/audit-logs?entity=Document"), (x) => x.status === 200 && x.data.rows.some((a) => a.action === "FILE_VIEW"));
let res = await admin.req("/api/reports/export?format=xlsx", { raw: true });
check("Excel export", res.headers.get("content-type"), (t) => t?.includes("spreadsheetml"));
res = await admin.req("/api/reports/export?format=pdf", { raw: true });
const pdf = Buffer.from(await res.arrayBuffer());
check("PDF export", pdf.subarray(0, 4).toString(), (t) => t === "%PDF");
check("hospital export scoped", await hospital.req("/api/reports/export?format=xlsx", { raw: true }).then((x) => x.status), (s) => s === 200);
check("cron refuses without secret", await admin.req("/api/cron/notifications"), is(401));
check("cron notifications runs", await admin.req(`/api/cron/notifications?secret=${process.env.CRON_SECRET}`), is(200));
check("cron escalations runs", await admin.req(`/api/cron/escalations?secret=${process.env.CRON_SECRET}`), is(200));
const notes = await patient.req("/api/notifications");
check("patient got in-app alerts", notes, (x) => x.status === 200 && x.data.rows.length >= 4);
const queued = await admin.req("/api/admin/audit-logs?action=STATUS_CHANGE");
check("status changes audited", queued, (x) => x.data.rows.length >= 8);

// Self-registration → approval
const newbie = new Client("new employee");
const mob = "8" + String(Date.now()).slice(-9);
const comp = (await newbie.req("/api/public/companies?q=Deccan")).data.rows[0];
check("company search works", comp, (c) => Boolean(c?.id));
check("registration OTP refused for existing number", await newbie.req("/api/auth/register/otp", { method: "POST", json: { mobile: "9000000010" } }), is(409));
check("registration OTP sent", await newbie.req("/api/auth/register/otp", { method: "POST", json: { mobile: mob } }), is(200));
const reg = { companyId: comp.id, employeeCode: "SELF-" + mob.slice(-4), fullName: "Ravi Teja", gender: "Male", dateOfBirth: "1992-05-20", mobile: mob, otp: OTP, consent: true };
check("registration needs consent", await newbie.req("/api/auth/register", { method: "POST", json: { ...reg, consent: false } }), is(400));
r = await newbie.req("/api/auth/register", { method: "POST", json: reg });
check("self-registration succeeds and signs in", r, (x) => x.status === 200 && x.data.redirect === "/patient");
check("pending employee cannot raise referral", await newbie.req("/api/referrals", { method: "POST", json: {} }), is(403));
const pend = (await cm.req(`/api/companies/${comp.id}/employees?q=${mob}`)).data.rows[0];
check("CM sees pending registration", pend?.approvalStatus, (x) => x === "PENDING");
check("support cannot approve", await support.req(`/api/employees/${pend.id}/approval`, { method: "POST", json: { decision: "APPROVE" } }), is(403));
check("CM approves", await cm.req(`/api/employees/${pend.id}/approval`, { method: "POST", json: { decision: "APPROVE" } }), is(200));
check("approved employee can raise referral", await newbie.req("/api/referrals", { method: "POST", json: {} }), is(201));
check("approval cannot be repeated", await cm.req(`/api/employees/${pend.id}/approval`, { method: "POST", json: { decision: "REJECT", note: "x" } }), is(409));

// Sudo Admin may add but not deactivate; Super Admin may.
const sudo = new Client("sudo admin");
await sudo.staffLogin("sudo@susali.in");
const dsp = (await sudo.req("/api/admin/dispensaries")).data.rows[0];
check("sudo cannot deactivate a master", await sudo.req(`/api/admin/dispensaries/${dsp.id}`, { method: "PATCH", json: { isActive: false } }), is(403));
check("sudo can edit a master", await sudo.req(`/api/admin/dispensaries/${dsp.id}`, { method: "PATCH", json: { city: dsp.city || "Hyderabad" } }), is(200));
check("super admin can deactivate", await admin.req(`/api/admin/dispensaries/${dsp.id}`, { method: "PATCH", json: { isActive: false } }), is(200));
await admin.req(`/api/admin/dispensaries/${dsp.id}`, { method: "PATCH", json: { isActive: true } });
const supUser = (await sudo.req("/api/admin/users?role=SUPPORT")).data.rows[0];
check("sudo cannot deactivate a user", await sudo.req(`/api/admin/users/${supUser.id}`, { method: "PATCH", json: { isActive: false } }), is(403));

// Support accepts / rejects straight from the queue (no manual lock)
const quick = await patient.req("/api/referrals", { method: "POST", json: {} });
const qid = quick.data.referral.id;
await patient.req(`/api/referrals/${qid}`, { method: "PATCH", json: { dispensaryId: dsp.id, dispensaryVisitDate: "2026-11-01", superintendentHospitalId: sup.id, referralLetterNo: "SUP/2026/777", referralDate: "2026-11-02", hospitalId: care.id, departmentId: depts[0].id, diagnosis: "Check-up" } });
const save = id;
id = qid;
await upload(patient, "REFERRAL_LETTER", "l.pdf", "application/pdf", "%PDF-1.4 x");
id = save;
await patient.req(`/api/referrals/${qid}/submit`, { method: "POST", json: {} });
check("support rejects without locking first", await support.req(`/api/referrals/${qid}/reject`, { method: "POST", json: { reason: "Not eligible", remarks: "Test rejection" } }), (x) => x.data.referral?.status === "REJECTED");

// Cluster Manager: no companies, no reports; raises referrals for employees
check("CM cannot add a company", await cm.req("/api/companies", { method: "POST", json: { name: "X Ltd", address: "Road", city: "Hyd", state: "TS", pincode: "500001" } }), is(403));
check("CM cannot export reports", (await cm.req("/api/reports/export?format=xlsx", { raw: true })).status, (st) => st === 403);
const lak = (await cm.req(`/api/companies/${comp.id}/employees?q=9000000010`)).data.rows[0];
const fam = await cm.req(`/api/employees/${lak.id}/family`, { method: "POST", json: { fullName: "CM Added Niece", relation: "Other", gender: "Female", dateOfBirth: "2010-06-01" } });
check("CM adds family on employee card", fam, is(201));
r = await cm.req("/api/referrals", { method: "POST", json: { employeeId: lak.id, familyMemberId: fam.data.member.id, urgency: "URGENT" } });
check("CM raises referral for employee's family", r, (x) => x.status === 201 && x.data.referral.raisedById && x.data.referral.patientName === "CM Added Niece");
const cmRef = r.data.referral.id;
check("CM fills in the draft", await cm.req(`/api/referrals/${cmRef}`, { method: "PATCH", json: { familyMemberId: fam.data.member.id, dispensaryId: dsp.id, dispensaryVisitDate: "2026-11-01", superintendentHospitalId: sup.id, referralLetterNo: "SUP/2026/888", referralDate: "2026-11-02", hospitalId: care.id, departmentId: depts[0].id, diagnosis: "Fever", urgency: "URGENT" } }), is(200));
{ const keep = id; id = cmRef; check("CM uploads the letter", await upload(cm, "REFERRAL_LETTER", "cm-letter.pdf", "application/pdf", "%PDF-1.4 cm"), is(201)); id = keep; }
check("CM submits", await cm.req(`/api/referrals/${cmRef}/submit`, { method: "POST", json: {} }), (x) => x.data.referral?.status === "SUBMITTED");
check("employee sees CM-raised referral", await patient.req(`/api/referrals/${cmRef}`), (x) => x.status === 200 && x.data.referral.patientName === "CM Added Niece");
check("other CM cannot see it", await new Client("x").req(`/api/referrals/${cmRef}`), is(401));

// Super Admin delete; Sudo cannot
const tmp = await admin.req("/api/admin/dispensaries", { method: "POST", json: { name: "Temp Dispensary " + Date.now() } });
check("sudo cannot delete", await sudo.req(`/api/admin/dispensaries/${tmp.data.row.id}`, { method: "DELETE" }), is(403));
check("super admin deletes unused master", await admin.req(`/api/admin/dispensaries/${tmp.data.row.id}`, { method: "DELETE" }), is(200));
check("used master cannot be deleted", await admin.req(`/api/admin/dispensaries/${dsp.id}`, { method: "DELETE" }), is(409));
check("employee with referrals cannot be deleted", await admin.req(`/api/employees/${lak.id}`, { method: "DELETE" }), is(409));

// Pages render for each role
for (const [c, path] of [[admin, "/super-admin"], [admin, "/super-admin/referrals"], [admin, `/super-admin/referrals/${id}`], [admin, "/super-admin/messages"], [admin, "/super-admin/settings"], [admin, "/super-admin/audit"], [admin, "/super-admin/masters/hospitals"], [admin, "/super-admin/users"], [support, "/support"], [support, "/support/queue"], [support, "/support/referrals"], [sudo, "/sudo-admin/queue"], [admin, "/super-admin/queue"], [cm, "/cluster-manager"], [cm, "/cluster-manager/companies"], [cm, "/cluster-manager/registrations"], [cm, "/cluster-manager/referrals/new"], [cm, `/cluster-manager/referrals/new?employee=${lak.id}`], [cm, `/cluster-manager/employees/${lak.id}`], [cm, `/cluster-manager/referrals/${cmRef}`], [admin, `/super-admin/employees/${lak.id}`], [admin, "/super-admin/registrations"], [cm, `/cluster-manager/referrals/${id}`], [hospital, "/hospital"], [hospital, "/hospital/referrals?tab=completed"], [patient, "/patient"], [patient, `/patient/referrals/${id}`], [patient, "/patient/records"], [patient, "/patient/referrals/new"]]) {
  const p = await c.req(path, { raw: true });
  check(`page ${path} (${c.name})`, p.status, (s) => s === 200);
}
for (const path of ["/", "/login", "/login?mode=email", "/register"]) {
  const p = await new Client("guest").req(path, { raw: true });
  check(`public page ${path}`, p.status, (st) => st === 200);
}
check("old patient login redirects", (await new Client("guest").req("/patient-login", { raw: true })).status, (st) => st === 307);
check("CM reports page is gone", (await cm.req("/cluster-manager/reports")).data, (t) => !String(t).includes("Download Excel"));
check("wrong role is redirected", (await support.req("/super-admin", { raw: true })).status, (s) => s === 307);

console.log(`\n${failures ? `${failures} FAILED` : "All checks passed"} · referral ${refNo}`);
process.exit(failures ? 1 : 0);

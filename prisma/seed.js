// Seeds the first Super Admin, departments and sample masters.
// With SEED_DEMO=1 (default outside production) it also adds one demo user per
// role plus a demo company and employee, so every flow can be tried at once.
// Run: npm run seed

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const DEPARTMENTS = [
  "General Medicine", "Cardiology", "Orthopaedics", "Neurology", "Nephrology", "Oncology",
  "Gastroenterology", "Pulmonology", "ENT", "Ophthalmology", "Obstetrics & Gynaecology",
  "Paediatrics", "General Surgery", "Urology", "Dermatology", "Psychiatry", "Radiology",
];

async function upsertUser({ email, password, ...rest }) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, ...rest },
  });
}

async function findOrCreate(model, where, data) {
  const found = await prisma[model].findFirst({ where });
  return found || prisma[model].create({ data: { ...where, ...data } });
}

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@susali.in").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe@123";
  const admin = await upsertUser({ name: "Super Admin", email: adminEmail, mobile: "9000000000", password: adminPassword, role: "SUPER_ADMIN" });
  console.log(`Super Admin: ${adminEmail}`);

  const depts = {};
  for (const name of DEPARTMENTS) {
    depts[name] = await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
  }

  const cluster = await prisma.cluster.upsert({
    where: { code: "HYD-N" },
    update: {},
    create: { name: "Hyderabad North", code: "HYD-N", region: "Telangana" },
  });
  const vja = await prisma.cluster.upsert({
    where: { code: "VJA" },
    update: {},
    create: { name: "Vijayawada", code: "VJA", region: "Andhra Pradesh" },
  });

  const hospital = await prisma.hospital.upsert({
    where: { code: "CARE-HYD" },
    update: {},
    create: {
      name: "Care Multispeciality Hospital", code: "CARE-HYD", address: "Road No. 1, Banjara Hills",
      city: "Hyderabad", state: "Telangana", pincode: "500034", phone: "04030418888", email: "referrals@carehyd.example",
      departmentIds: ["General Medicine", "Cardiology", "Orthopaedics", "Neurology", "General Surgery"].map((d) => depts[d].id),
    },
  });
  const sunrise = await prisma.hospital.upsert({
    where: { code: "SUN-HYD" },
    update: {},
    create: {
      name: "Sunrise Super Speciality Hospital", code: "SUN-HYD", address: "Begumpet Main Road",
      city: "Hyderabad", state: "Telangana", pincode: "500016", phone: "04023456789", email: "desk@sunrise.example",
      departmentIds: Object.values(depts).map((d) => d.id),
    },
  });

  // ESI is not shown anywhere in SUSALI: rename older seeded masters and
  // remove any stored ESI numbers.
  const RENAMES = [
    ["dispensary", "ESI Dispensary, Sanathnagar", "Government Dispensary, Sanathnagar"],
    ["dispensary", "ESI Dispensary, Balanagar", "Government Dispensary, Balanagar"],
    ["superintendentHospital", "ESIC Hospital, Sanathnagar", "Area Hospital, Sanathnagar"],
    ["superintendentHospital", "ESI Hospital, Nacharam", "District Hospital, Nacharam"],
  ];
  for (const [model, from, to] of RENAMES) await prisma[model].updateMany({ where: { name: from }, data: { name: to } });
  await prisma.$runCommandRaw({ update: "Employee", updates: [{ q: { esiNumber: { $exists: true } }, u: { $unset: { esiNumber: "" } }, multi: true }] });
  await prisma.$runCommandRaw({ update: "Referral", updates: [{ q: { "patientSnapshot.esiNumber": { $exists: true } }, u: { $unset: { "patientSnapshot.esiNumber": "" } }, multi: true }] });
  await prisma.referral.updateMany({ where: { verifierNotes: { contains: "ESIC" } }, data: { verifierNotes: "Letter verified against superintendent hospital records." } });

  const dispensary = await findOrCreate("dispensary", { name: "Government Dispensary, Sanathnagar" }, { address: "Sanathnagar", city: "Hyderabad" });
  const dispensary2 = await findOrCreate("dispensary", { name: "Government Dispensary, Balanagar" }, { address: "Balanagar", city: "Hyderabad" });
  const sup1 = await findOrCreate("superintendentHospital", { name: "Area Hospital, Sanathnagar" }, { address: "Erragadda", city: "Hyderabad" });
  const sup2 = await findOrCreate("superintendentHospital", { name: "District Hospital, Nacharam" }, { address: "Nacharam", city: "Hyderabad" });

  const demo = process.env.SEED_DEMO ? process.env.SEED_DEMO === "1" : process.env.NODE_ENV !== "production";
  if (demo) {
    const pw = "Demo@1234";
    const sudo = await upsertUser({ name: "Sudo Admin (demo)", email: "sudo@susali.in", mobile: "9000000002", password: pw, role: "SUDO_ADMIN" });
    const support = await upsertUser({ name: "Support Agent (demo)", email: "support@susali.in", mobile: "9000000003", password: pw, role: "SUPPORT" });
    const cm = await upsertUser({ name: "Cluster Manager (demo)", email: "cm@susali.in", mobile: "9000000004", password: pw, role: "CLUSTER_MANAGER", clusterIds: [cluster.id] });
    await prisma.cluster.update({ where: { id: cluster.id }, data: { managerIds: { set: Array.from(new Set([...(cluster.managerIds || []), cm.id])) } } });
    const hospUser = await upsertUser({ name: "Hospital Desk (demo)", email: "hospital@susali.in", mobile: "9000000005", password: pw, role: "HOSPITAL_USER", hospitalId: hospital.id });
    const cm2 = await upsertUser({ name: "Cluster Manager VJA (demo)", email: "cm2@susali.in", mobile: "9000000006", password: pw, role: "CLUSTER_MANAGER", clusterIds: [vja.id] });
    const vjaNow = await prisma.cluster.findUnique({ where: { id: vja.id } });
    if (!vjaNow.managerIds.includes(cm2.id)) await prisma.cluster.update({ where: { id: vja.id }, data: { managerIds: { set: [...vjaNow.managerIds, cm2.id] } } });

    let company = await prisma.company.findFirst({ where: { name: "Deccan Precision Tools Pvt Ltd" } });
    if (!company) {
      const c = await prisma.counter.upsert({ where: { id: "company" }, create: { id: "company", seq: 1 }, update: { seq: { increment: 1 } } });
      company = await prisma.company.create({
        data: {
          code: `SUS-CMP-${String(c.seq).padStart(4, "0")}`, name: "Deccan Precision Tools Pvt Ltd", industry: "Manufacturing",
          address: "Plot 12, IDA Balanagar", city: "Hyderabad", district: "Medchal", state: "Telangana", pincode: "500037",
          hrName: "Ravi Kumar", hrMobile: "9876500001", hrEmail: "hr@deccantools.example",
          clusterId: cluster.id, dispensaryId: dispensary.id, createdById: cm.id,
        },
      });
    }
    await prisma.employee.upsert({
      where: { mobile: "9000000010" },
      update: {},
      create: {
        employeeCode: "DPT-1001", companyId: company.id, fullName: "Lakshmi Prasad", gender: "Female",
        dateOfBirth: new Date("1988-04-12"), mobile: "9000000010", email: "lakshmi@example.com",
        department: "Assembly", designation: "Technician", bloodGroup: "B+", address: "Kukatpally, Hyderabad",
        emergencyName: "Srinivas Prasad", emergencyMobile: "9876500002",
      },
    });
    await require("./seed-demo")(prisma, {
      users: { admin, sudo, support, cm, cm2, hospital: hospUser },
      clusters: { hyd: cluster, vja },
      hospitals: [hospital, sunrise],
      depts,
      dispensaries: [dispensary, dispensary2],
      superintendents: [sup1, sup2],
    });
    console.log("Demo staff (password Demo@1234): sudo@, support@, cm@, cm2@, hospital@susali.in");
    console.log("Demo patient mobile: 9000000010 (dev OTP from DEV_OTP)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

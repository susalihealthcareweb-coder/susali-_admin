// Automated end-to-end tests in a throwaway environment.
//
//   npm run test:e2e
//
// 1. Points at a separate database, susali_test, on the same MongoDB cluster
//    as .env (your real data is never touched), creates its indexes and seeds it.
//    Add --reset (npm run test:e2e -- --reset) to wipe the test database first.
// 2. Starts its own server on port 3200 (own build folder, so your dev server
//    can keep running) with SMS, WhatsApp and email simulated.
// 3. Runs the website workflow test (scripts/e2e.mjs) and, if ../susali-mobile
//    exists, the mobile app API test (../susali-mobile/scripts/api-check.mjs).
// 4. With --screens, also taps through the app in the iOS simulator with
//    Maestro (../susali-mobile/.maestro). Needs Maestro installed and the test
//    app built once: cd ../susali-mobile && npm run build:ios:test
// 5. Stops the server and exits non-zero if anything failed.
// --serve skips the tests and keeps the test server running for manual testing.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = Number(process.env.TEST_PORT || 3200);
const BASE = `http://localhost:${PORT}`;
const TEST_DB = "susali_test";

const fileEnv = parseEnv(readFileSync(path.join(ROOT, ".env"), "utf8"));
if (!fileEnv.DATABASE_URL) throw new Error("DATABASE_URL is missing from .env");

// Same cluster, different database name.
const url = new URL(fileEnv.DATABASE_URL);
url.pathname = "/" + TEST_DB;
const DATABASE_URL = url.toString();
if (new URL(DATABASE_URL).pathname !== "/" + TEST_DB) throw new Error("Refusing to run: test database name check failed");

// Values set here win over .env (Next.js and Prisma both prefer the real environment).
const env = {
  ...process.env,
  ...fileEnv,
  DATABASE_URL,
  NODE_ENV: "development",
  NEXT_DIST_DIR: ".next/test",
  APP_URL: BASE,
  AUTH_URL: BASE,
  // Simulated: no SMS, WhatsApp, email or cloud storage leaves this machine.
  MSG91_AUTH_KEY: "",
  MSG91_OTP_TEMPLATE_ID: "",
  MSG91_WHATSAPP_NUMBER: "",
  FIXED_OTP: "",
  DEV_OTP: "123456",
  SMTP_HOST: "",
  R2_BUCKET: "",
  SEED_DEMO: "1",
  SEED_ADMIN_EMAIL: "admin@susali.in",
  SEED_ADMIN_PASSWORD: "ChangeMe@123",
  CRON_SECRET: fileEnv.CRON_SECRET || "test-cron-secret",
};

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: ROOT, env, stdio: "inherit", ...opts });
    p.on("exit", (code) => resolve(code ?? 1));
  });
}

async function waitForServer(ms = 120000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(BASE + "/api/auth/csrf");
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

const step = (t) => console.log(`\n=== ${t} ===`);
// Each test stage logs the demo patient in by OTP. Clear the OTP history in the
// TEST database between stages so one stage's 30-second resend gap and
// 5-per-15-minutes limit do not block the next.
const clearTestOtps = () => run("node", ["-e", `const { PrismaClient } = require("@prisma/client"); const p = new PrismaClient(); p.otpRequest.deleteMany({ where: { mobile: "9010561998" } }).then(() => p.$disconnect());`]);
const results = [];
let server;

try {
  const reset = process.argv.includes("--reset");
  step(`${reset ? "Wiping and preparing" : "Preparing"} test database "${TEST_DB}"`);
  const push = ["prisma", "db", "push", "--skip-generate", ...(reset ? ["--force-reset"] : [])];
  if ((await run("npx", push)) !== 0) throw new Error("db push failed");
  if ((await run("node", ["prisma/seed.js"])) !== 0) throw new Error("seed failed");

  step(`Starting test server on ${BASE}`);
  server = spawn("npx", ["next", "dev", "-p", String(PORT)], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  if (!(await waitForServer())) {
    console.log(log.slice(-3000));
    throw new Error("test server did not start");
  }
  // First requests compile routes; warm the slow ones so the tests do not time out.
  for (const p of ["/login", "/api/auth/session", "/api/me"]) await fetch(BASE + p).catch(() => {});
  // Compile the OTP routes too (an empty body is rejected, so no OTP is created).
  for (const p of ["/api/auth/otp/send", "/api/mobile/auth/otp", "/api/mobile/auth/login"]) {
    await fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
  }

  // --serve: keep the test server up for clicking through by hand (Ctrl+C stops it).
  if (process.argv.includes("--serve")) {
    console.log(`\nTest server running at ${BASE} on the "${TEST_DB}" database. Press Ctrl+C to stop.`);
    // A timer keeps Node running until Ctrl+C (otherwise it exits straight away).
    const keepAlive = setInterval(() => {}, 1 << 30);
    await new Promise((resolve) => { process.on("SIGINT", resolve); process.on("SIGTERM", resolve); });
    clearInterval(keepAlive);
    results.push(["serve", 0]);
    throw Object.assign(new Error("stopped"), { quiet: true });
  }

  step("Website workflow (scripts/e2e.mjs)");
  results.push(["website", await run("node", ["scripts/e2e.mjs", BASE])]);

  const mobile = path.resolve(ROOT, "../susali-mobile/scripts/api-check.mjs");
  if (existsSync(mobile)) {
    step("Mobile app API (susali-mobile/scripts/api-check.mjs)");
    await clearTestOtps();
    results.push(["mobile app", await run("node", [mobile, BASE])]);
  } else {
    console.log("(skipping mobile app tests: ../susali-mobile not found)");
  }

  if (process.argv.includes("--screens")) {
    step("App screens in the iOS simulator (Maestro)");
    const flows = path.resolve(ROOT, "../susali-mobile/.maestro");
    if (PORT !== 3200) console.log("Note: the test app is built for port 3200; set TEST_PORT=3200.");
    // Maestro needs Java 17+: Homebrew's openjdk (installed with Maestro) or Android Studio's.
    const javas = ["/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home", "/Applications/Android Studio.app/Contents/jbr/Contents/Home"];
    const java = process.env.JAVA_HOME || javas.find((j) => existsSync(j));
    const javaEnv = java ? { JAVA_HOME: java, MAESTRO_CLI_NO_ANALYTICS: "1" } : {};
    await clearTestOtps();
    const code = await run("maestro", ["test", flows, "--format", "junit", "--output", path.join(ROOT, ".next", "test", "maestro-report.xml")], { env: { ...env, ...javaEnv }, cwd: path.dirname(flows) });
    results.push(["app screens", code]);
  }
} catch (e) {
  if (!e.quiet) {
    console.error("\nTest run aborted:", e.message);
    results.push(["setup", 1]);
  }
} finally {
  if (server) {
    try { process.kill(-server.pid, "SIGTERM"); } catch {}
  }
}

step("Summary");
for (const [name, code] of results) console.log(`${code === 0 ? "PASS" : "FAIL"}  ${name}`);
process.exit(results.every(([, c]) => c === 0) ? 0 : 1);

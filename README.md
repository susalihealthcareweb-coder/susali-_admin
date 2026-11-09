# SUSALI

Referral-management platform that tracks a company employee from a dispensary referral to hospital treatment and back. Built from *SUSALI – Functional Project Specification* (Nov 8, 2026).

**Stack:** Next.js 16 (App Router, JavaScript) · MongoDB + Prisma 6 · Auth.js v5 · MSG91 (WhatsApp + OTP) · Nodemailer · Cloudflare R2 file storage · installable PWA.

## Run it

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL and AUTH_SECRET at minimum
npx prisma db push        # create collections and indexes
npm run seed              # Super Admin, departments, sample masters, demo users
npm run dev
```

Open http://localhost:3000.

### Demo accounts (created by the seed outside production)

| Role | Login |
|---|---|
| Super Admin | `admin@susali.in` / `SEED_ADMIN_PASSWORD` (default `ChangeMe@123`) |
| Sudo Admin | `sudo@susali.in` / `Demo@1234` |
| Support Team | `support@susali.in` / `Demo@1234` |
| Cluster Manager | `cm@susali.in` / `Demo@1234` |
| Hospital User | `hospital@susali.in` / `Demo@1234` |
| Patient | mobile `9000000010`, OTP = `DEV_OTP` (default `123456`) |

### Who can do what

| Role | Can do |
|---|---|
| **Super Admin** | Everything, including **permanent delete** (only for records nothing else uses; otherwise deactivate) and deactivate/reactivate |
| **Sudo Admin** | Everything else: add and edit companies, hospitals, masters, users, employees; verify referrals; reopen and reassign. Cannot delete or deactivate |
| **Support Team** | Handles queries; **Accepts** (verify and forward) or **Rejects** referrals in one step, asks patients for details, closes completed cases |
| **Cluster Manager** | Adds employees and their family, approves self-registrations, logs company visits, and **raises referrals on an employee's behalf** (draft → letter upload → submit). No companies, no reports |
| **Hospital User** | Accepts or declines referrals, marks the visit, uploads prescriptions, lab reports and scans, completes the case |
| **Employee (patient)** | Raises referrals for self or family, tracks them, sees reports. Referrals raised by their Cluster Manager appear in their app too |

Everyone logs in at `/login`: the **Mobile OTP** side is for employees, the **Email & password** side for staff.

### Family members

An employee's card covers their family. Patients add family members under **Profile → My family** (spouse, children, parents and so on). When raising a referral they choose **who it is for**: themselves or a family member. Every list, alert and export shows the patient's name and relation, plus the card holder. Seeded example: Lakshmi Prasad (`9000000010`) has a spouse, son and mother.

### Branding

The look follows the SUSALI Healthcare logo: emerald, gold and cream, with Cinzel / Cormorant Garamond / Montserrat fonts. Brand files are in `public/brand/` (emblem, full logo, wordmark) and app icons in `public/icons/`, cut from the supplied artwork.

ESI numbers are not collected or shown anywhere.

### Self-registration

New employees can register themselves at `/register` (company search → personal details → contact → mobile OTP + consent). They are created as **awaiting approval**: they can log in and see their status, but cannot raise referrals until their Cluster Manager (or an admin) approves them on the **Approvals** page or the company's employee list. Approve or reject sends them a WhatsApp message.

Set `SEED_DEMO=0` before seeding production, and change the Super Admin password.

### Development without third-party keys

| Service | When its env vars are empty (development only) |
|---|---|
| MSG91 | OTP is `DEV_OTP`; WhatsApp sends are logged to the console and marked `simulated` |
| SMTP | Emails are logged to the console and marked `simulated` |
| Cloudflare R2 | Files are stored in `./.uploads` behind HMAC-signed 10-minute links |

In production each of these refuses to run unconfigured instead of simulating.

## End-to-end test

With the dev server running and the demo seed loaded:

```bash
node --env-file=.env scripts/e2e.mjs http://localhost:3000
```

It walks one referral through every role and stage (draft → info requested → resubmit → forward → accept → OTP visit → treatment → uploads → complete → close → reopen), and checks scope rules, lifecycle guards, signed file links, exports, cron routes and that every role's pages render. OTP sends are rate-limited (30 s between sends, 5 per 15 minutes), so wait a minute between runs.

## Where things are

```
prisma/schema.prisma        data model (spec section 8)
prisma/seed.js              seed data
src/proxy.js                optimistic route protection by role (Next 16 "proxy" = middleware)
src/lib/
  auth.js, auth.config.js   Auth.js: staff email+password, patient mobile OTP
  session.js, scope.js      current user, role checks, cluster/hospital/patient data scope
  permissions.js            role × action map (spec section 6)
  referral-flow.js          allowed status transitions (spec section 3)
  referral-actions.js       guarded status change + history + audit
  notify.js                 event → recipients → Notification rows → worker (spec section 7)
  msg91.js, mailer.js       WhatsApp/OTP and email transports
  storage.js                Cloudflare R2 signed upload/download URLs
  dashboard.js              dashboard counts, turnaround, escalation detection
src/app/api/                route handlers (spec section 9.1)
src/app/[role]/             staff app: super-admin, sudo-admin, support, cluster-manager, hospital
src/app/patient/            patient PWA
```

Every API route checks role and scope on the server. Status routes are all under `/api/referrals/:id/<action>` (submit, lock, unlock, forward, request-info, reject, accept, decline, visit-otp, visit, treatment, complete, cancel, close, reopen, reassign, override).

## File storage: Cloudflare R2

Referral letters, prescriptions, lab reports, scans and visit photos live in a **private** R2 bucket. Browsers and the mobile app upload straight to R2 with a 15-minute signed link, and files open through 10-minute signed links. The bucket is never public.

1. Cloudflare dashboard → **R2** → **Create bucket** (e.g. `susali-files`). Leave public access **off**. Pick the location hint nearest your users (Asia-Pacific).
2. **R2 → Manage API tokens → Create API token** with *Object Read & Write*, limited to that bucket. Copy the Access Key ID and Secret Access Key.
3. Set in the website's environment:
   ```
   R2_ACCOUNT_ID=<your Cloudflare account ID>
   R2_ACCESS_KEY_ID=<from the token>
   R2_SECRET_ACCESS_KEY=<from the token>
   R2_BUCKET=susali-files
   ```
4. Bucket → **Settings → CORS policy → Add**, paste `r2-cors.json` (edit the origins to your domains). The mobile app needs no CORS; the website does.
5. Check it: `node --env-file=.env scripts/r2-check.mjs https://app.susali.in`. It uploads, downloads and deletes a small test file through signed links and confirms CORS.

Files already stored locally in `.uploads/` during development are not copied to R2. Re-run `npm run seed` on a fresh database to upload the demo PDFs to R2.

## Scheduled jobs

Protected by `CRON_SECRET` (as `Authorization: Bearer …` or `?secret=…`).

| Job | Route | What it does |
|---|---|---|
| Notifications | `/api/cron/notifications` | sends queued WhatsApp/email, retries at 1, 5, 15 min, then marks Failed |
| Escalations | `/api/cron/escalations` | raises time-limit escalations once per stage; auto-closes completed referrals |
| Daily summary | `/api/cron/daily-summary` | 9 AM IST summary email per role scope |

**How they run on Vercel's free Hobby plan** (cron jobs limited to once a day):

1. `vercel.json` schedules all three **daily** (03:30, 04:00, 04:30 UTC), which Hobby allows.
2. **Background runs:** after any API request, the site runs whatever is due: the notification queue at most every minute and escalations at most every 15 minutes. A database lock (`Counter` rows `job:*`) makes sure only one server runs each job at a time. New alerts are also sent straight after the action that caused them. Set `BACKGROUND_JOBS=off` to disable.
3. **Optional exact timing, free:** `.github/workflows/cron.yml` calls the routes every 5 / 15 minutes from GitHub Actions. Add the repository secrets `SUSALI_URL` and `CRON_SECRET`.

On Vercel Pro you can instead change `vercel.json` back to `*/5 * * * *` (notifications) and `*/15 * * * *` (escalations).

## Additions and choices beyond the spec

- **Draft fields are optional** in the `Referral` model so a patient can save part-way; `submit` enforces every required field and the referral letter.
- Drafts get a temporary `DRAFT-…` number; the `SUS-REF-YYYY-NNNNNN` number is issued at first submission from an atomic counter.
- **Extra collections/fields:** `FamilyMember`, `Referral.familyMemberId/patientName/patientRelation`, `Counter` (referral and company numbers), `Setting` (time limits, file limits, template overrides), `Employee.consentAt` (DPDP consent), `Referral.escalations` and `treatmentNotes`, `OtpRequest.purpose` (login vs. hospital visit).
- **Unlock:** a verifier can release a locked referral back to the queue; admins can reassign it.
- **Reopen:** Rejected → Submitted; Closed → Completed.
- Hospital declines are recorded against the hospital in the audit log, so hospital performance counts declines after the referral moves on.
- Cluster Managers never receive medical documents or the diagnosis text.
- **Self-registration** (`Employee.approvalStatus`, `selfRegistered`) goes beyond the spec, which only allowed employees added by a Cluster Manager; approval keeps that control.
- Reports leave out diagnosis so they can be shared offline with superintendents.
- PWA service worker never caches pages or API data (health records); it only provides an offline screen. The referral form keeps an unsaved copy in the phone's local storage.

## Go-live checklist

- [ ] MongoDB Atlas with daily backups (30 days)
- [ ] `AUTH_SECRET`, `CRON_SECRET` set to long random values
- [ ] MSG91: auth key, WhatsApp number, OTP template, and the WhatsApp templates listed in Settings approved
- [ ] SMTP credentials and `MAIL_FROM`
- [ ] Cloudflare R2 bucket (private), API token, `R2_*` set, CORS from `r2-cors.json`, `scripts/r2-check.mjs` passes
- [ ] `APP_URL` set to the public HTTPS URL
- [ ] Seed with `SEED_DEMO=0`, change the Super Admin password
- [ ] Cron jobs scheduled

import Link from "next/link";
import { staffPage } from "@/lib/page";
import { adminDashboard, supportDashboard, clusterDashboard, hospitalDashboard, chartData, hospitalPerformance } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard, Section, BarList, MonthBars, StatusBadge } from "@/components/ui";
import { STATUS, PIPELINE, OPEN_STATUSES } from "@/lib/constants";
import { fmtHours, fmtDateTime } from "@/lib/format";
import { listReferrals } from "@/lib/referral-queries";
import { pendingRegistrations } from "@/lib/employees";
import PatientLabel from "@/components/PatientLabel";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ params }) {
  const { me, base, role } = await staffPage(params);
  if (role === "SUPER_ADMIN") return <SuperAdmin base={base} />;
  if (role === "SUDO_ADMIN") return <SudoAdmin me={me} base={base} />;
  if (role === "SUPPORT") return <Support me={me} base={base} />;
  if (role === "CLUSTER_MANAGER") return <ClusterManager me={me} base={base} />;
  return <HospitalHome me={me} base={base} />;
}

function Cards({ d, base }) {
  const c = d.cards;
  const R = base + "/referrals";
  return (
    <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard label="Clusters" value={c.clusters} href={base + "/masters/clusters"} />
      <StatCard label="Companies" value={c.companies} href={base + "/companies"} />
      <StatCard label="Employees" value={c.employees} />
      <StatCard label="Hospitals" value={c.hospitals} href={base + "/masters/hospitals"} />
      <StatCard label="Referrals today" value={c.refToday} href={R} />
      <StatCard label="This month" value={c.refMonth} href={R} />
      <StatCard label="Open" value={c.open} href={`${R}?status=${OPEN_STATUSES.join(",")}`} />
      <StatCard label="Completed" value={c.completed} href={`${R}?status=COMPLETED,CLOSED`} />
    </div>
  );
}

function Pipeline({ d, base }) {
  const max = Math.max(...d.pipeline.map((p) => p.count), 1);
  return (
    <Section title="Referral pipeline">
      <div className="stagger grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-8">
        {d.pipeline.map((p) => (
          <Link key={p.status} href={`${base}/referrals?status=${p.status}`} className="lift rounded-lg border border-slate-200 p-2.5 hover:border-brand-500" title={`${STATUS[p.status].label}: ${p.count}`}>
            <div className="truncate text-[11px] font-medium text-slate-500">{STATUS[p.status].label}</div>
            <div className="text-xl font-semibold tabular-nums">{p.count}</div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="animate-grow-x h-1.5 rounded-full bg-brand-600" style={{ width: `${(p.count / max) * 100}%` }} /></div>
          </Link>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        {["INFO_REQUESTED", "HOSPITAL_DECLINED", "REJECTED", "CANCELLED"].map((s) => (
          <Link key={s} href={`${base}/referrals?status=${s}`} className="hover:text-slate-800">{STATUS[s].label}: <b className="tabular-nums text-slate-800">{d.byStatus[s] || 0}</b></Link>
        ))}
      </div>
    </Section>
  );
}

function Overdue({ d, base }) {
  const o = d.overdue;
  const s = o.settings;
  const link = (ids) => `${base}/referrals?ids=${ids.slice(0, 100).join(",")}`;
  return (
    <Section title="Pending past time limit">
      <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={`Submitted > ${s.submittedLimitWorkingHours} work hrs`} value={o.submitted.length} href={link(o.submitted)} tone="bad" />
        <StatCard label={`Forwarded > ${s.forwardedLimitHours} h`} value={o.forwarded.length} href={link(o.forwarded)} tone="bad" />
        <StatCard label={`Accepted > ${s.acceptedLimitHours} h`} value={o.accepted.length} href={link(o.accepted)} tone="bad" />
        <StatCard label={`Visited > ${s.visitedLimitDays} days`} value={o.visited.length} href={link(o.visited)} tone="bad" />
      </div>
    </Section>
  );
}

function Turnaround({ d }) {
  const t = d.turnaround;
  return (
    <Section title="Average turnaround">
      <dl className="grid grid-cols-3 gap-3 text-center">
        {[["Verification", t.verify, "Submitted → Forwarded"], ["To visit", t.visit, "Forwarded → Visited"], ["Treatment", t.complete, "Visited → Completed"]].map(([l, v, h]) => (
          <div key={l}><dt className="text-xs text-slate-500">{l}</dt><dd className="text-lg font-semibold tabular-nums">{fmtHours(v)}</dd><dd className="text-[11px] text-slate-400">{h}</dd></div>
        ))}
      </dl>
    </Section>
  );
}

async function SuperAdmin({ base }) {
  const [delEmps, delUsers] = await Promise.all([
    prisma.employee.findMany({ where: { deletionRequestedAt: { not: null }, NOT: { fullName: "Erased employee" } }, select: { id: true, fullName: true, deletionRequestedAt: true }, orderBy: { deletionRequestedAt: "asc" }, take: 20 }),
    prisma.user.findMany({ where: { deletionRequestedAt: { not: null }, NOT: { name: "Erased user" } }, select: { id: true, name: true, role: true, deletionRequestedAt: true }, take: 20 }),
  ]);
  const [d, charts, perf, health] = await Promise.all([
    adminDashboard(),
    chartData(),
    hospitalPerformance(),
    prisma.notification.groupBy({ by: ["channel", "status"], where: { channel: { in: ["WHATSAPP", "EMAIL"] } }, _count: { _all: true } }),
  ]);
  const h = (ch, st) => health.find((x) => x.channel === ch && x.status === st)?._count._all || 0;
  return (
    <div className="space-y-5">
      <PageHeader title="Super Admin dashboard" subtitle="Every cluster, company, referral and hospital." actions={<Link href={base + "/reports"} className="btn-secondary">Export reports</Link>} />
      <Cards d={d} base={base} />
      {(delEmps.length > 0 || delUsers.length > 0) && (
        <Section title={`Account deletion requests (${delEmps.length + delUsers.length})`}>
          <ul className="divide-y divide-slate-100 text-sm">
            {delEmps.map((e) => <li key={e.id} className="flex justify-between gap-2 py-2"><Link className="link" href={`${base}/employees/${e.id}`}>{e.fullName}</Link><span className="text-xs text-slate-500">Employee · {fmtDateTime(e.deletionRequestedAt)}</span></li>)}
            {delUsers.map((u) => <li key={u.id} className="flex justify-between gap-2 py-2"><Link className="link" href={`${base}/users`}>{u.name}</Link><span className="text-xs text-slate-500">Staff · {fmtDateTime(u.deletionRequestedAt)}</span></li>)}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Complete within 30 days: delete the account, or erase personal data if it has referral history.</p>
        </Section>
      )}
      <Pipeline d={d} base={base} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Turnaround d={d} />
        <Section title="Notification health" actions={<Link className="link text-sm" href={base + "/messages"}>Open</Link>}>
          <table className="table">
            <thead><tr><th>Channel</th><th>Queued</th><th>Sent</th><th>Failed</th></tr></thead>
            <tbody>
              {["WHATSAPP", "EMAIL"].map((c) => (
                <tr key={c}><td>{c === "WHATSAPP" ? "WhatsApp" : "Email"}</td><td className="tabular-nums">{h(c, "QUEUED")}</td><td className="tabular-nums">{h(c, "SENT") + h(c, "DELIVERED")}</td><td className={`tabular-nums ${h(c, "FAILED") ? "font-semibold text-red-700" : ""}`}>{h(c, "FAILED")}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
      <Overdue d={d} base={base} />
      <Section title="Referrals per month"><MonthBars months={charts.months} /></Section>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Section title="By cluster"><BarList items={charts.cluster} /></Section>
        <Section title="By company"><BarList items={charts.company} /></Section>
        <Section title="By hospital"><BarList items={charts.hospital} /></Section>
        <Section title="By department"><BarList items={charts.department} /></Section>
        <Section title="Rejection reasons"><BarList items={charts.rejection} empty="No rejections" /></Section>
      </div>
      <Section title="Hospital performance">
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Hospital</th><th>Accepted</th><th>Declined</th><th>Documents pending</th><th>Avg. accept → complete</th></tr></thead>
            <tbody>
              {perf.map((p) => (
                <tr key={p.id}><td className="font-medium">{p.name}</td><td className="tabular-nums">{p.accepted}</td><td className="tabular-nums">{p.declined}</td><td className="tabular-nums">{p.pendingDocs}</td><td>{fmtHours(p.avgCompletion)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

async function SudoAdmin({ me, base }) {
  const [d, s] = await Promise.all([adminDashboard(), supportDashboard(me)]);
  return (
    <div className="space-y-5">
      <PageHeader title="Sudo Admin dashboard" subtitle="Verification, escalations and masters." actions={<Link href={base + "/queue"} className="btn-primary">Open Verification Queue ({s.queue})</Link>} />
      <SupportCards s={s} base={base} />
      <Overdue d={d} base={base} />
      <Pipeline d={d} base={base} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Turnaround d={d} />
        <Section title="Masters">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[["Clusters", "clusters"], ["Hospitals", "hospitals"], ["Dispensaries", "dispensaries"], ["Superintendent hospitals", "superintendent-hospitals"], ["Departments", "departments"]].map(([l, k]) => (
              <Link key={k} className="rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-500" href={`${base}/masters/${k}`}>{l}</Link>
            ))}
            <Link className="rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-500" href={`${base}/users`}>Staff users</Link>
          </div>
        </Section>
      </div>
    </div>
  );
}

function SupportCards({ s, base }) {
  const R = base + "/referrals";
  return (
    <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      <StatCard label="Verification Queue" value={s.queue} href={base + "/queue"} tone="warn" />
      <StatCard label="Locked by me" value={s.mine} href={`${R}?view=mine`} />
      <StatCard label="I forwarded today" value={s.forwardedToday} />
      <StatCard label="Information requested" value={s.info} href={`${R}?status=INFO_REQUESTED`} />
      <StatCard label="Hospital declined" value={s.declined} href={`${R}?status=HOSPITAL_DECLINED`} tone="warn" />
      <StatCard label={`Not visited in ${s.settings.followUpForwardedHours} h`} value={s.followForward} href={`${R}?view=follow-forward`} tone="warn" />
      <StatCard label={`Not completed in ${s.settings.visitedLimitDays} days`} value={s.followVisit} href={`${R}?view=follow-visit`} tone="warn" />
    </div>
  );
}

async function Support({ me, base }) {
  const s = await supportDashboard(me);
  const mine = await listReferrals(me, { extra: { status: "UNDER_VERIFICATION", lockedById: me.id } }, { take: 10 });
  return (
    <div className="space-y-5">
      <PageHeader title="Support dashboard" subtitle="Verify referrals and follow up with patients and hospitals." actions={<Link href={base + "/queue"} className="btn-primary">Open Verification Queue ({s.queue})</Link>} />
      <SupportCards s={s} base={base} />
      <Section title="My work">
        {mine.rows.length ? (
          <ul className="divide-y divide-slate-100">
            {mine.rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                <Link href={`${base}/referrals/${r.id}`} className="link">{r.referralNo}</Link>
                <span className="min-w-0 flex-1 text-sm"><PatientLabel r={r} showCode={false} /></span><span className="hidden truncate text-sm text-slate-500 sm:inline">{r.companyName}</span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">You have no referrals locked. Pick the next one from the queue.</p>}
      </Section>
    </div>
  );
}

async function ClusterManager({ me, base }) {
  const [d, pending] = await Promise.all([clusterDashboard(me), pendingRegistrations(me)]);
  const recent = await listReferrals(me, {}, { take: 8 });
  const clusters = await prisma.cluster.findMany({ where: { id: { in: me.clusterIds } }, select: { name: true } });
  return (
    <div className="space-y-5">
      <PageHeader title={`Hello, ${me.name.split(" ")[0]}`} subtitle={clusters.map((c) => c.name).join(", ") || "No cluster assigned yet"} actions={<><Link href={base + "/companies"} className="btn-secondary">Add employee</Link><Link href={base + "/referrals/new"} className="btn-primary">+ New referral</Link></>} />
      <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="My companies" value={d.companies} href={base + "/companies"} />
        <StatCard label="My employees" value={d.employees} href={base + "/companies"} />
        <StatCard label="Referrals this month" value={d.refMonth} href={base + "/referrals"} />
        <StatCard label="Open referrals" value={d.open} href={`${base}/referrals?status=${OPEN_STATUSES.join(",")}`} />
      </div>
      {pending > 0 && (
        <Link href={`${base}/registrations`} className="lift flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 ring-1 ring-amber-200">
          <span className="text-sm text-amber-900"><b className="tabular-nums">{pending}</b> employee{pending === 1 ? "" : "s"} registered themselves and {pending === 1 ? "is" : "are"} waiting for your approval.</span>
          <span className="btn-primary btn-sm shrink-0">Review</span>
        </Link>
      )}
      <Section title="Referrals by status">
        <BarList items={PIPELINE.concat(["INFO_REQUESTED", "HOSPITAL_DECLINED", "REJECTED"]).filter((s) => d.byStatus[s]).map((s) => ({ label: STATUS[s].label, count: d.byStatus[s], href: `${base}/referrals?status=${s}` }))} href empty="No referrals yet in your cluster." />
      </Section>
      <Section title="Latest referrals" actions={<Link className="link text-sm" href={base + "/referrals"}>All</Link>}>
        {recent.rows.length ? (
          <ul className="divide-y divide-slate-100">
            {recent.rows.map((r) => (
              <li key={r.id}>
                <Link href={`${base}/referrals/${r.id}`} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0"><div className="text-sm"><PatientLabel r={r} showCode={false} /></div><div className="truncate text-xs text-slate-500">{r.referralNo} · {r.companyName} · {fmtDateTime(r.updatedAt)}</div></div>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">No referrals yet.</p>}
      </Section>
    </div>
  );
}

async function HospitalHome({ me, base }) {
  const d = await hospitalDashboard(me);
  const incoming = await listReferrals(me, { status: "FORWARDED" }, { take: 20, orderBy: { forwardedAt: "asc" } });
  const R = base + "/referrals?tab=";
  return (
    <div className="space-y-5">
      <PageHeader title="Hospital dashboard" subtitle="Verified referrals forwarded to your hospital." />
      <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Incoming" value={d.incoming} href={R + "incoming"} tone="warn" />
        <StatCard label="Expected patients" value={d.expected} href={R + "expected"} />
        <StatCard label="In progress" value={d.inProgress} href={R + "progress"} />
        <StatCard label="Documents pending" value={d.pendingDocs} href={R + "pending"} tone="warn" />
        <StatCard label="Completed" value={d.completed} href={R + "completed"} />
      </div>
      <Section title="Incoming referrals — accept or decline">
        {incoming.rows.length ? (
          <ul className="divide-y divide-slate-100">
            {incoming.rows.map((r) => (
              <li key={r.id}>
                <Link href={`${base}/referrals/${r.id}`} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0"><div className="text-sm"><PatientLabel r={r} showCode={false} /></div><div className="truncate text-xs text-slate-500">{r.department?.name}</div><div className="text-xs text-slate-500">{r.referralNo} · forwarded {fmtDateTime(r.forwardedAt)}</div></div>
                  <span className="btn-secondary btn-sm">Review</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">No new referrals waiting.</p>}
      </Section>
    </div>
  );
}

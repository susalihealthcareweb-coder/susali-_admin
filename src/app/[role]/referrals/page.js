import Link from "next/link";
import { staffPage, qs } from "@/lib/page";
import { listReferrals } from "@/lib/referral-queries";
import { getSettings } from "@/lib/settings";
import { viewFilter } from "@/lib/referral-views";
import { prisma } from "@/lib/prisma";
import { PageHeader, Pagination, Tabs, Empty } from "@/components/ui";
import { STATUS } from "@/lib/constants";
import ReferralCard from "@/components/ReferralCard";
import QueueActions from "@/components/QueueActions";

export const metadata = { title: "Referrals" };

const HOSPITAL_TABS = {
  incoming: { label: "Incoming", status: "FORWARDED" },
  expected: { label: "Expected patients", status: "ACCEPTED" },
  progress: { label: "In progress", status: "VISITED,UNDER_TREATMENT" },
  pending: { label: "Pending documents", status: "VISITED,UNDER_TREATMENT" },
  completed: { label: "Completed", status: "COMPLETED,CLOSED" },
};

export default async function Referrals({ params, searchParams }) {
  const { me, base, role } = await staffPage(params);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const opts = { status: sp.status, q: sp.q, hospitalId: sp.hospitalId, clusterId: sp.clusterId, from: sp.from, to: sp.to };
  const s = await getSettings();
  const view = viewFilter(sp, me, s);
  if (view.extra) opts.extra = view.extra;
  const title = view.title;
  const tab = role === "HOSPITAL_USER" ? (HOSPITAL_TABS[sp.tab] ? sp.tab : null) : null;
  if (tab) opts.status = HOSPITAL_TABS[tab].status;

  const { rows, pages } = await listReferrals(me, opts, { page });
  const isAdminish = ["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT"].includes(role);
  const [hospitals, clusters] = await Promise.all([
    isAdminish ? prisma.hospital.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    isAdminish ? prisma.cluster.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);
  let docCounts = {};
  if (tab === "pending" && rows.length) {
    const g = await prisma.document.groupBy({ by: ["referralId"], where: { referralId: { in: rows.map((r) => r.id) }, category: "PRESCRIPTION", isDeleted: false }, _count: { _all: true } });
    docCounts = Object.fromEntries(g.map((x) => [x.referralId, x._count._all]));
  }
  const shown = tab === "pending" ? rows.filter((r) => !docCounts[r.id]) : rows;

  return (
    <>
      <PageHeader title={title} subtitle={role === "CLUSTER_MANAGER" ? "Referrals in your cluster, including those you raised for employees." : undefined} actions={role === "CLUSTER_MANAGER" ? <Link className="btn-primary" href={`${base}/referrals/new`}>+ New referral</Link> : <Link className="btn-secondary" href={`${base}/reports${qs(sp, { page: null, view: null, ids: null, tab: null, q: null })}`}>Export</Link>} />
      {role === "HOSPITAL_USER" && (
        <Tabs active={tab || "all"} tabs={[{ key: "all", label: "All", href: `${base}/referrals` }, ...Object.entries(HOSPITAL_TABS).map(([k, t]) => ({ key: k, label: t.label, href: `${base}/referrals?tab=${k}` }))]} />
      )}
      {!sp.view && !sp.ids && !tab && (
        <form className="card card-pad mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
          <div className="lg:col-span-2"><label className="label">Search</label><input className="input" name="q" defaultValue={sp.q} placeholder="Referral no, patient, mobile, employee ID, company" /></div>
          <div>
            <label className="label">Status</label>
            <select className="input" name="status" defaultValue={sp.status || ""}>
              <option value="">All</option>
              {Object.entries(STATUS).filter(([k]) => k !== "DRAFT").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              {sp.status?.includes(",") && <option value={sp.status}>Selected group</option>}
            </select>
          </div>
          {isAdminish && (
            <div>
              <label className="label">Hospital</label>
              <select className="input" name="hospitalId" defaultValue={sp.hospitalId || ""}><option value="">All</option>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
            </div>
          )}
          {isAdminish && (
            <div>
              <label className="label">Cluster</label>
              <select className="input" name="clusterId" defaultValue={sp.clusterId || ""}><option value="">All</option>{clusters.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
            </div>
          )}
          <div className="flex items-end gap-2"><button className="btn-primary">Apply</button><Link className="btn-ghost" href={`${base}/referrals`}>Clear</Link></div>
        </form>
      )}
      {shown.length ? (
        <div className="stagger grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {shown.map((r) => (
            <ReferralCard
              key={r.id}
              r={r}
              me={me}
              href={`${base}/referrals/${r.id}`}
              actions={isAdminish && ["SUBMITTED", "HOSPITAL_DECLINED"].includes(r.status) ? <QueueActions id={r.id} href={`${base}/referrals/${r.id}`} hospitalName={r.hospital?.name} declined={r.status === "HOSPITAL_DECLINED"} /> : null}
            />
          ))}
        </div>
      ) : <Empty title="No referrals match">Try a different filter.</Empty>}
      <Pagination page={page} pages={pages} makeHref={(p) => `${base}/referrals${qs(sp, { page: p })}`} />
    </>
  );
}

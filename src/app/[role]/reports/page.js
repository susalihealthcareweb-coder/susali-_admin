import { prisma } from "@/lib/prisma";
import { staffPage } from "@/lib/page";
import { companyScope } from "@/lib/scope";
import { PageHeader } from "@/components/ui";
import { STATUS } from "@/lib/constants";

export const metadata = { title: "Reports" };

// Export referrals to Excel or PDF, e.g. to share with superintendents offline.
export default async function Reports({ params, searchParams }) {
  const { me, role } = await staffPage(params, ["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "HOSPITAL_USER"]);
  const sp = await searchParams;
  const admin = ["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT"].includes(role);
  const [clusters, companies, hospitals] = await Promise.all([
    admin ? prisma.cluster.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : role === "CLUSTER_MANAGER" ? prisma.cluster.findMany({ where: { id: { in: me.clusterIds } }, select: { id: true, name: true } }) : [],
    role === "HOSPITAL_USER" ? [] : prisma.company.findMany({ where: companyScope(me), select: { id: true, name: true }, orderBy: { name: "asc" }, take: 1000 }),
    admin ? prisma.hospital.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);
  return (
    <>
      <PageHeader title="Reports and exports" subtitle={role === "CLUSTER_MANAGER" ? "Referrals in your cluster." : role === "HOSPITAL_USER" ? "Referrals forwarded to your hospital." : "All referrals. Diagnosis is left out so reports can be shared offline."} />
      <form action="/api/reports/export" method="get" className="card card-pad grid max-w-3xl gap-4 sm:grid-cols-2">
        <div><label className="label">From</label><input type="date" className="input" name="from" defaultValue={sp.from} /></div>
        <div><label className="label">To</label><input type="date" className="input" name="to" defaultValue={sp.to} /></div>
        {clusters.length > 1 && <Select sp={sp} name="clusterId" label="Cluster" items={clusters} />}
        {companies.length > 0 && <Select sp={sp} name="companyId" label="Company" items={companies} />}
        {hospitals.length > 0 && <Select sp={sp} name="hospitalId" label="Hospital" items={hospitals} />}
        <div><label className="label">Status</label><select className="input" name="status" defaultValue={sp.status || ""}><option value="">All</option>{Object.entries(STATUS).filter(([k]) => k !== "DRAFT").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        <div className="flex gap-2 sm:col-span-2">
          <button className="btn-primary" name="format" value="xlsx">Download Excel</button>
          <button className="btn-secondary" name="format" value="pdf">Download PDF</button>
        </div>
      </form>
    </>
  );
}

function Select({ name, label, items, sp }) {
  return (
    <div><label className="label">{label}</label><select className="input" name={name} defaultValue={sp[name] || ""}><option value="">All</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
  );
}

import { prisma } from "@/lib/prisma";
import { staffPage } from "@/lib/page";
import { PageHeader, Empty } from "@/components/ui";
import CompanyForm from "@/components/CompanyForm";

export const metadata = { title: "Add company" };

export default async function NewCompany({ params }) {
  const { me, base, role } = await staffPage(params, ["SUPER_ADMIN", "SUDO_ADMIN"]);
  const isCm = role === "CLUSTER_MANAGER";
  const [dispensaries, clusters] = await Promise.all([
    prisma.dispensary.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.cluster.findMany({ where: { isActive: true, ...(isCm ? { id: { in: me.clusterIds } } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Add company" back={{ href: `${base}/companies`, label: "Companies" }} subtitle="The company code is generated when you save." />
      {clusters.length ? <CompanyForm dispensaries={dispensaries} clusters={clusters} canChooseCluster={!isCm} base={base} /> : <Empty title="No cluster assigned">Ask a Sudo Admin to assign you to a cluster first.</Empty>}
    </>
  );
}

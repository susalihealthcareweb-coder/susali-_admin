import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { staffPage } from "@/lib/page";
import { companyScope } from "@/lib/scope";
import { PageHeader } from "@/components/ui";
import CompanyForm from "@/components/CompanyForm";

export const metadata = { title: "Edit company" };

export default async function EditCompany({ params }) {
  const { me, base, role } = await staffPage(params, ["SUPER_ADMIN", "SUDO_ADMIN"]);
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) notFound();
  const company = await prisma.company.findFirst({ where: { AND: [{ id }, companyScope(me)] } });
  if (!company) notFound();
  const isCm = role === "CLUSTER_MANAGER";
  const [dispensaries, clusters] = await Promise.all([
    prisma.dispensary.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.cluster.findMany({ where: isCm ? { id: { in: me.clusterIds } } : {}, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title={`Edit ${company.name}`} back={{ href: `${base}/companies/${id}`, label: company.name }} />
      <CompanyForm company={JSON.parse(JSON.stringify(company))} dispensaries={dispensaries} clusters={clusters} canChooseCluster={!isCm} base={base} />
    </>
  );
}

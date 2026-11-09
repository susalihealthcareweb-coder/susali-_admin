import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { staffPage } from "@/lib/page";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Masters" };

export default async function Masters({ params }) {
  const { base } = await staffPage(params, ["SUPER_ADMIN", "SUDO_ADMIN"]);
  const counts = await Promise.all([prisma.cluster.count(), prisma.hospital.count(), prisma.dispensary.count(), prisma.superintendentHospital.count(), prisma.department.count()]);
  const items = [
    ["clusters", "Clusters", "Groups of companies under Cluster Managers"],
    ["hospitals", "Hospitals", "Empanelled treating hospitals and their departments"],
    ["dispensaries", "Dispensaries", "Offline company and government dispensaries"],
    ["superintendent-hospitals", "Superintendent hospitals", "Offline hospitals that issue referral letters"],
    ["departments", "Departments", "Specialities such as Cardiology or Orthopaedics"],
  ];
  return (
    <>
      <PageHeader title="Masters" subtitle="Reference data used across SUSALI." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([k, l, d], i) => (
          <Link key={k} href={`${base}/masters/${k}`} className="lift card card-pad block hover:border-brand-500">
            <div className="flex items-baseline justify-between"><span className="font-semibold">{l}</span><span className="text-xl font-semibold tabular-nums text-slate-400">{counts[i]}</span></div>
            <p className="mt-1 text-sm text-slate-500">{d}</p>
          </Link>
        ))}
        <Link href={`${base}/users`} className="lift card card-pad block hover:border-brand-500"><div className="font-semibold">Staff users</div><p className="mt-1 text-sm text-slate-500">Support, Cluster Managers, Hospital Users and admins</p></Link>
      </div>
    </>
  );
}

import { prisma } from "@/lib/prisma";
import { staffPage } from "@/lib/page";
import { SAFE_USER } from "@/lib/users";
import { PageHeader, Tabs } from "@/components/ui";
import UserManager from "@/components/UserManager";
import { ROLES } from "@/lib/constants";

export const metadata = { title: "Users" };

export default async function Users({ params, searchParams }) {
  const { me, base, role } = await staffPage(params, ["SUPER_ADMIN", "SUDO_ADMIN"]);
  const sp = await searchParams;
  const filter = ROLES[sp.role] && sp.role !== "PATIENT" ? sp.role : null;
  const [users, clusters, hospitals] = await Promise.all([
    prisma.user.findMany({ where: filter ? { role: filter } : {}, select: SAFE_USER, orderBy: [{ role: "asc" }, { name: "asc" }] }),
    prisma.cluster.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.hospital.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const roles = ["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "CLUSTER_MANAGER", "HOSPITAL_USER"];
  return (
    <>
      <PageHeader title="Staff users" subtitle={role === "SUDO_ADMIN" ? "You can manage Support, Cluster Manager and Hospital users." : "All logins except patients."} />
      <Tabs active={filter || "all"} tabs={[{ key: "all", label: "All", href: `${base}/users` }, ...roles.map((r) => ({ key: r, label: ROLES[r].label, href: `${base}/users?role=${r}` }))]} />
      <UserManager users={JSON.parse(JSON.stringify(users))} clusters={clusters} hospitals={hospitals} myRole={role} myId={me.id} />
    </>
  );
}

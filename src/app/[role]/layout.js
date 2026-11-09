import { notFound } from "next/navigation";
import StaffShell from "@/components/StaffShell";
import { navFor } from "@/components/nav";
import { requirePage } from "@/lib/session";
import { roleFromSlug, ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { pendingRegistrations } from "@/lib/employees";

export default async function StaffLayout({ children, params }) {
  const { role: slug } = await params;
  const role = roleFromSlug(slug);
  if (!role || role === "PATIENT") notFound();
  const me = await requirePage([role]);
  const base = "/" + ROLES[role].slug;
  const [unread, pending] = await Promise.all([
    prisma.notification.count({ where: { userId: me.id, channel: "IN_APP", isRead: false } }),
    ["SUPER_ADMIN", "SUDO_ADMIN", "CLUSTER_MANAGER"].includes(role) ? pendingRegistrations(me) : 0,
  ]);
  let roleLabel = ROLES[role].label;
  if (role === "HOSPITAL_USER" && me.hospitalId) {
    const h = await prisma.hospital.findUnique({ where: { id: me.hospitalId }, select: { name: true } });
    if (h) roleLabel += ` · ${h.name}`;
  }
  return (
    <StaffShell nav={navFor(role, base)} base={base} user={{ name: me.name }} roleLabel={roleLabel} badges={{ Alerts: unread, Approvals: pending }}>
      {children}
    </StaffShell>
  );
}

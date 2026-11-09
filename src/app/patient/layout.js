import { requirePage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import PatientShell from "@/components/PatientShell";
import Consent from "@/components/Consent";

export const metadata = { title: { default: "My SUSALI", template: "%s · SUSALI" } };

export default async function PatientLayout({ children }) {
  const me = await requirePage(["PATIENT"]);
  const unread = await prisma.notification.count({ where: { employeeId: me.id, channel: "IN_APP", isRead: false } });
  return (
    <PatientShell name={me.name} unread={unread}>
      {me.employee.consentAt ? children : <Consent />}
    </PatientShell>
  );
}

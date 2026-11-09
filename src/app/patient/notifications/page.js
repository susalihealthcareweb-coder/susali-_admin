import { requirePage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NotificationFeed from "@/components/NotificationFeed";

export const metadata = { title: "Alerts" };

export default async function PatientAlerts() {
  const me = await requirePage(["PATIENT"]);
  const rows = await prisma.notification.findMany({ where: { employeeId: me.id, channel: "IN_APP" }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Alerts</h1>
      <NotificationFeed rows={JSON.parse(JSON.stringify(rows))} linkBase="/patient" />
    </div>
  );
}

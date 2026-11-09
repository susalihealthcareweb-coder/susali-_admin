import { prisma } from "@/lib/prisma";
import { staffPage } from "@/lib/page";
import { PageHeader } from "@/components/ui";
import NotificationFeed from "@/components/NotificationFeed";

export const metadata = { title: "Alerts" };

export default async function Page({ params }) {
  const { me, base } = await staffPage(params);
  const rows = await prisma.notification.findMany({ where: { userId: me.id, channel: "IN_APP" }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <PageHeader title="Alerts" subtitle="The same alerts are also sent on WhatsApp and email where set up." />
      <NotificationFeed rows={JSON.parse(JSON.stringify(rows))} linkBase={base} />
    </>
  );
}

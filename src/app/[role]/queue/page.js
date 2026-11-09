import Link from "next/link";
import { staffPage } from "@/lib/page";
import { verificationQueue } from "@/lib/referral-queries";
import { PageHeader, Empty, StatCard } from "@/components/ui";
import QueueActions from "@/components/QueueActions";
import ReferralCard from "@/components/ReferralCard";

export const metadata = { title: "Verification Queue" };

// Submitted and re-routed referrals, most urgent and oldest first.
export default async function Queue({ params }) {
  const { me, base, role } = await staffPage(params, ["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT"]);
  const rows = await verificationQueue(me);
  return (
    <>
      <PageHeader title="Verification Queue" subtitle="Accept to verify and forward to the hospital, or reject. Most urgent and oldest first." />
      <div className="stagger mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Waiting" value={rows.filter((r) => r.status === "SUBMITTED").length} />
        <StatCard label="Emergency" value={rows.filter((r) => r.urgency === "EMERGENCY").length} tone="bad" />
        <StatCard label="Hospital declined" value={rows.filter((r) => r.status === "HOSPITAL_DECLINED").length} tone="warn" />
        <StatCard label="Being reviewed" value={rows.filter((r) => r.status === "UNDER_VERIFICATION").length} />
      </div>
      {rows.length ? (
        <div className="stagger grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {rows.map((r) => {
            const lockedByOther = r.status === "UNDER_VERIFICATION" && r.lockedById !== me.id;
            return (
              <ReferralCard
                key={r.id}
                r={r}
                me={me}
                waiting
                href={`${base}/referrals/${r.id}`}
                actions={lockedByOther && role === "SUPPORT" ? <Link href={`${base}/referrals/${r.id}`} className="btn-ghost btn-sm w-full">View</Link> : <QueueActions id={r.id} href={`${base}/referrals/${r.id}`} hospitalName={r.hospital?.name} declined={r.status === "HOSPITAL_DECLINED"} />}
              />
            );
          })}
        </div>
      ) : <Empty title="The queue is clear">New submissions will appear here.</Empty>}
    </>
  );
}

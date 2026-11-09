import Link from "next/link";
import { requirePage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "My referrals" };

export default async function MyReferrals() {
  const me = await requirePage(["PATIENT"]);
  const rows = await prisma.referral.findMany({ where: { employeeId: me.id }, orderBy: { createdAt: "desc" }, include: { hospital: { select: { name: true } }, department: { select: { name: true } } } });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-3xl text-brand-900">My referrals</h1><Link href="/patient/referrals/new" className="btn-primary btn-sm">New</Link></div>
      {rows.length ? (
        <ul className="card divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/patient/referrals/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-medium">{r.status === "DRAFT" ? "Draft" : r.referralNo}</div>
                  <div className="truncate text-xs text-slate-500">{r.patientRelation && r.patientRelation !== "Self" ? `${r.patientName} (${r.patientRelation}) · ` : ""}{r.hospital?.name || "Hospital not chosen"}{r.department ? ` · ${r.department.name}` : ""} · {fmtDate(r.submittedAt || r.createdAt)}</div>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : <div className="card card-pad text-sm text-slate-500">No referrals yet.</div>}
    </div>
  );
}

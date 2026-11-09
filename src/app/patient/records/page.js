import Link from "next/link";
import { requirePage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DocumentList } from "@/components/Documents";
import { HOSPITAL_DOC_CATEGORIES } from "@/lib/constants";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "My records" };

// Prescriptions, lab reports and scans, grouped by referral and category.
export default async function Records() {
  const me = await requirePage(["PATIENT"]);
  const refs = await prisma.referral.findMany({
    where: { employeeId: me.id, documents: { some: { isDeleted: false, category: { in: HOSPITAL_DOC_CATEGORIES } } } },
    orderBy: { completedAt: "desc" },
    include: { hospital: { select: { name: true } }, documents: { where: { isDeleted: false, category: { in: HOSPITAL_DOC_CATEGORIES } }, orderBy: { createdAt: "asc" } } },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-3xl text-brand-900">My records</h1>
      <p className="text-sm text-slate-500">Files open through a secure link that expires after 10 minutes.</p>
      {refs.length ? refs.map((r) => (
        <section key={r.id} className="card card-pad space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <Link href={`/patient/referrals/${r.id}`} className="font-mono text-sm font-semibold text-brand-800">{r.referralNo}</Link>
            <span className="text-xs text-slate-500">{r.patientRelation && r.patientRelation !== "Self" ? `${r.patientName} · ` : ""}{r.hospital?.name} · {fmtDate(r.completedAt || r.visitedAt)}</span>
          </div>
          <DocumentList documents={JSON.parse(JSON.stringify(r.documents))} />
        </section>
      )) : <div className="card card-pad text-sm text-slate-500">Reports from the hospital will appear here after your treatment.</div>}
    </div>
  );
}

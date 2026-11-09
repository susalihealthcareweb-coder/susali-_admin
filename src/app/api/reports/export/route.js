import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { referralWhere } from "@/lib/referral-queries";
import { audit } from "@/lib/audit";
import { STATUS, URGENCY } from "@/lib/constants";
import { fmtDate, patientOf } from "@/lib/format";

// Excel or PDF export by date range, cluster, company or hospital, within the
// caller's scope. Diagnosis is left out so reports can be shared offline.
const COLUMNS = [
  ["referralNo", "Referral No", 20],
  ["status", "Status", 18],
  ["submitted", "Submitted", 12],
  ["patient", "Patient", 22],
  ["relation", "Relation", 12],
  ["employee", "Card holder", 20],
  ["empCode", "Emp ID", 12],
  ["company", "Company", 24],
  ["cluster", "Cluster", 16],
  ["dispensary", "Dispensary", 22],
  ["superintendent", "Superintendent Hospital", 24],
  ["letterNo", "Letter No", 14],
  ["hospital", "Treating Hospital", 24],
  ["department", "Department", 18],
  ["urgency", "Urgency", 10],
  ["forwarded", "Forwarded", 12],
  ["visited", "Visited", 12],
  ["completed", "Completed", 12],
];

export const GET = route(async (req) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "HOSPITAL_USER"]);
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const opts = Object.fromEntries(["status", "hospitalId", "clusterId", "companyId", "from", "to"].map((k) => [k, url.searchParams.get(k) || undefined]));
  const where = await referralWhere(me, opts);
  const refs = await prisma.referral.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    take: 20000,
    include: {
      employee: { select: { fullName: true, employeeCode: true } },
      hospital: { select: { name: true } },
      department: { select: { name: true } },
      dispensary: { select: { name: true } },
      superintendentHospital: { select: { name: true } },
    },
  });
  const [companies, clusters] = await Promise.all([
    prisma.company.findMany({ where: { id: { in: [...new Set(refs.map((r) => r.companyId))] } }, select: { id: true, name: true } }),
    prisma.cluster.findMany({ select: { id: true, name: true } }),
  ]);
  const cn = Object.fromEntries(companies.map((c) => [c.id, c.name]));
  const kn = Object.fromEntries(clusters.map((c) => [c.id, c.name]));
  const rows = refs.map((r) => ({
    referralNo: r.referralNo,
    status: STATUS[r.status].label,
    submitted: fmtDate(r.submittedAt),
    patient: patientOf(r).name,
    relation: patientOf(r).relation,
    employee: r.employee?.fullName || r.patientSnapshot?.name,
    empCode: r.patientSnapshot?.employeeCode || r.employee?.employeeCode,
    company: cn[r.companyId] || "",
    cluster: kn[r.clusterId] || "",
    dispensary: r.dispensary?.name || "",
    superintendent: [r.superintendentHospital?.name, r.superintendentName].filter(Boolean).join(" / "),
    letterNo: r.referralLetterNo || "",
    hospital: r.hospital?.name || "",
    department: r.department?.name || "",
    urgency: URGENCY[r.urgency].label,
    forwarded: fmtDate(r.forwardedAt),
    visited: fmtDate(r.visitedAt),
    completed: fmtDate(r.completedAt),
  }));
  await audit({ actor: me, action: "REPORT_EXPORT", entity: "Report", after: { format, ...opts, rows: rows.length }, req });

  const stamp = new Date().toISOString().slice(0, 10);
  const range = opts.from || opts.to ? `${opts.from || "start"} to ${opts.to || "today"}` : "All dates";

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "SUSALI";
    const ws = wb.addWorksheet("Referrals");
    ws.columns = COLUMNS.map(([key, header, width]) => ({ key, header, width }));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B4633" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    rows.forEach((r) => ws.addRow(r));
    ws.autoFilter = { from: "A1", to: { row: 1, column: COLUMNS.length } };
    const buf = await wb.xlsx.writeBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="SUSALI-referrals-${stamp}.xlsx"`,
      },
    });
  }

  const pdfCols = COLUMNS.filter(([k]) => !["cluster", "letterNo", "urgency", "dispensary", "employee"].includes(k));
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((res) => doc.on("end", res));
  const usable = doc.page.width - 56;
  const total = pdfCols.reduce((s, c) => s + c[2], 0);
  const widths = pdfCols.map((c) => (c[2] / total) * usable);
  doc.fontSize(14).fillColor("#0b4633").text("SUSALI Referral Report", { continued: false });
  doc.fontSize(8).fillColor("#475569").text(`${range} · ${rows.length} referrals · generated ${fmtDate(new Date())}`);
  doc.moveDown(0.5);
  const header = () => {
    let x = 28;
    const y = doc.y;
    doc.rect(28, y - 2, usable, 14).fill("#0b4633");
    doc.fillColor("#ffffff").fontSize(7);
    pdfCols.forEach(([, h], i) => { doc.text(h, x + 2, y + 1, { width: widths[i] - 4, lineBreak: false, ellipsis: true }); x += widths[i]; });
    doc.y = y + 14;
  };
  header();
  rows.forEach((r, n) => {
    if (doc.y > doc.page.height - 40) { doc.addPage(); header(); }
    let x = 28;
    const y = doc.y;
    if (n % 2) doc.rect(28, y - 1, usable, 12).fill("#f1f5f9");
    doc.fillColor("#0f172a").fontSize(6.5);
    pdfCols.forEach(([k], i) => { doc.text(String(r[k] ?? ""), x + 2, y + 1, { width: widths[i] - 4, lineBreak: false, ellipsis: true }); x += widths[i]; });
    doc.y = y + 12;
  });
  doc.end();
  await done;
  return new Response(Buffer.concat(chunks), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="SUSALI-referrals-${stamp}.pdf"` },
  });
});

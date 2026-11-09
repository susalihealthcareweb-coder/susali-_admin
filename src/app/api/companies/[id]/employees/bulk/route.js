import ExcelJS from "exceljs";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { route, ok, ApiError } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { getScopedCompany } from "@/lib/scope";
import { employeeSchema } from "@/lib/validators";
import { EMPLOYEE_COLUMNS } from "@/lib/employees";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim()));
}

function cellText(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") return String(v.text ?? v.result ?? v.richText?.map((t) => t.text).join("") ?? "");
  return String(v);
}

// Every row is validated; valid rows are saved and the rest come back as an error report.
export const POST = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "CLUSTER_MANAGER"]);
  const company = await getScopedCompany(me, id);
  if (!company.isActive) throw new ApiError(409, "This company is inactive.");
  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") throw new ApiError(400, "Choose an Excel or CSV file.");
  if (file.size > 5 * 1024 * 1024) throw new ApiError(400, "File must be 5 MB or smaller.");
  const buf = Buffer.from(await file.arrayBuffer());

  let table;
  if (file.name.toLowerCase().endsWith(".csv")) {
    table = parseCsv(buf.toString("utf8").replace(/^﻿/, ""));
  } else {
    const wb = new ExcelJS.Workbook();
    try { await wb.xlsx.load(buf); } catch { throw new ApiError(400, "Could not read this file. Use the .xlsx template or a CSV."); }
    const ws = wb.worksheets[0];
    table = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = [];
      for (let c = 1; c <= EMPLOYEE_COLUMNS.length; c++) vals.push(cellText(row.getCell(c).value));
      table.push(vals);
    });
  }
  if (table.length < 2) throw new ApiError(400, "The file has no employee rows.");
  if (table.length > 2001) throw new ApiError(400, "Upload at most 2,000 employees at a time.");

  const rows = table.slice(1);
  const errors = [];
  const valid = [];
  const seenMobile = new Set(), seenCode = new Set();
  rows.forEach((vals, i) => {
    const raw = Object.fromEntries(EMPLOYEE_COLUMNS.map(([k], c) => [k, String(vals[c] ?? "").trim() || undefined]));
    const res = employeeSchema.safeParse(raw);
    const rowNo = i + 2;
    if (!res.success) {
      errors.push({ row: rowNo, employeeCode: raw.employeeCode || "", error: res.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
      return;
    }
    if (seenMobile.has(res.data.mobile)) return errors.push({ row: rowNo, employeeCode: raw.employeeCode, error: "Mobile repeated in this file" });
    if (seenCode.has(res.data.employeeCode)) return errors.push({ row: rowNo, employeeCode: raw.employeeCode, error: "Employee ID repeated in this file" });
    seenMobile.add(res.data.mobile);
    seenCode.add(res.data.employeeCode);
    valid.push({ rowNo, data: res.data });
  });

  const [mobilesTaken, codesTaken] = await Promise.all([
    prisma.employee.findMany({ where: { mobile: { in: valid.map((x) => x.data.mobile) } }, select: { mobile: true } }),
    prisma.employee.findMany({ where: { companyId: id, employeeCode: { in: valid.map((x) => x.data.employeeCode) } }, select: { employeeCode: true } }),
  ]);
  const mt = new Set(mobilesTaken.map((x) => x.mobile));
  const ct = new Set(codesTaken.map((x) => x.employeeCode));
  const toSave = [];
  for (const x of valid) {
    if (mt.has(x.data.mobile)) errors.push({ row: x.rowNo, employeeCode: x.data.employeeCode, error: "Mobile already registered" });
    else if (ct.has(x.data.employeeCode)) errors.push({ row: x.rowNo, employeeCode: x.data.employeeCode, error: "Employee ID already exists in this company" });
    else toSave.push({ ...x.data, companyId: id });
  }
  if (toSave.length) await prisma.employee.createMany({ data: toSave });
  await audit({ actor: me, action: "BULK_UPLOAD", entity: "Company", entityId: id, after: { file: file.name, saved: toSave.length, rejected: errors.length }, req });

  // Welcome messages are queued after the response so large files return quickly.
  if (toSave.length) {
    after(async () => {
      const created = await prisma.employee.findMany({ where: { companyId: id, mobile: { in: toSave.map((e) => e.mobile) } } });
      for (const e of created) await notify("EMPLOYEE_ADDED", { employee: { ...e, company } });
    });
  }
  errors.sort((a, b) => a.row - b.row);
  return ok({ total: rows.length, saved: toSave.length, rejected: errors.length, errors });
});

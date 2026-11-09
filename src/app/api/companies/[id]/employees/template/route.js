import ExcelJS from "exceljs";
import { route } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { getScopedCompany } from "@/lib/scope";
import { EMPLOYEE_COLUMNS } from "@/lib/employees";

// Excel template for bulk employee upload.
export const GET = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "CLUSTER_MANAGER"]);
  const company = await getScopedCompany(me, id);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Employees");
  ws.columns = EMPLOYEE_COLUMNS.map(([key, header]) => ({ key, header, width: Math.max(14, header.length + 2) }));
  ws.getRow(1).font = { bold: true };
  ws.addRow({ employeeCode: "EMP001", fullName: "Sample Name", gender: "Male", dateOfBirth: "1990-01-31", mobile: "9876543210", bloodGroup: "O+" });
  ws.getColumn("dateOfBirth").numFmt = "@";
  ws.getColumn("mobile").numFmt = "@";
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="SUSALI-employees-${company.code}.xlsx"`,
    },
  });
});

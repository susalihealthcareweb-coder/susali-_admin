import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError, pageParams } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { getScopedCompany } from "@/lib/scope";
import { employeeSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { checkEmployeeUnique } from "@/lib/employees";

export const GET = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "CLUSTER_MANAGER"]);
  await getScopedCompany(me, id);
  const url = new URL(req.url);
  const { page, take, skip } = pageParams(url);
  const q = url.searchParams.get("q");
  const where = { companyId: id, ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { employeeCode: { contains: q, mode: "insensitive" } }, { mobile: { contains: q } }] } : {}) };
  const [rows, total] = await Promise.all([
    prisma.employee.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.employee.count({ where }),
  ]);
  return ok({ rows, total, page, pages: Math.max(1, Math.ceil(total / take)) });
});

export const POST = route(async (req, { id }) => {
  const me = await requireApi(["SUPER_ADMIN", "SUDO_ADMIN", "CLUSTER_MANAGER"]);
  const company = await getScopedCompany(me, id);
  if (!company.isActive) throw new ApiError(409, "This company is inactive.");
  const data = await body(req, employeeSchema);
  const clash = await checkEmployeeUnique(id, data);
  if (clash) throw new ApiError(409, clash);
  const employee = await prisma.employee.create({ data: { ...data, companyId: id } });
  await audit({ actor: me, action: "CREATE", entity: "Employee", entityId: employee.id, after: employee, req });
  await notify("EMPLOYEE_ADDED", { employee: { ...employee, company } });
  return ok({ employee }, { status: 201 });
});

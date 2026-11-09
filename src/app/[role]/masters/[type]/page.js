import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { staffPage } from "@/lib/page";
import { MASTER_MODELS } from "@/lib/validators";
import { PageHeader } from "@/components/ui";
import MasterManager from "@/components/MasterManager";

const CONFIG = {
  clusters: { title: "Clusters", fields: [{ key: "name", label: "Name", required: true }, { key: "code", label: "Code", required: true }, { key: "region", label: "Region" }] },
  hospitals: {
    title: "Hospitals",
    fields: [
      { key: "name", label: "Name", required: true }, { key: "code", label: "Code", required: true }, { key: "city", label: "City", required: true },
      { key: "address", label: "Address", required: true, hideInTable: true, full: true }, { key: "state", label: "State", required: true, hideInTable: true },
      { key: "pincode", label: "PIN code", required: true, hideInTable: true }, { key: "phone", label: "Phone", required: true },
      { key: "email", label: "Official email", required: true, type: "email" }, { key: "departmentIds", label: "Departments", type: "multi" },
    ],
  },
  dispensaries: { title: "Dispensaries", fields: [{ key: "name", label: "Name", required: true }, { key: "address", label: "Address" }, { key: "city", label: "City" }] },
  "superintendent-hospitals": { title: "Superintendent hospitals", fields: [{ key: "name", label: "Name", required: true }, { key: "address", label: "Address" }, { key: "city", label: "City" }] },
  departments: { title: "Departments", fields: [{ key: "name", label: "Name", required: true }] },
};

export default async function MasterPage({ params }) {
  const { base, role } = await staffPage(params, ["SUPER_ADMIN", "SUDO_ADMIN"]);
  const { type } = await params;
  const cfg = CONFIG[type];
  if (!cfg) notFound();
  const [rows, departments] = await Promise.all([
    prisma[MASTER_MODELS[type]].findMany({ orderBy: { name: "asc" } }),
    type === "hospitals" ? prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : [],
  ]);
  return (
    <>
      <PageHeader title={cfg.title} back={{ href: `${base}/masters`, label: "Masters" }} />
      <MasterManager type={type} rows={JSON.parse(JSON.stringify(rows))} fields={cfg.fields} departments={departments} canEdit canToggle={role === "SUPER_ADMIN"} canDelete={role === "SUPER_ADMIN"} />
    </>
  );
}

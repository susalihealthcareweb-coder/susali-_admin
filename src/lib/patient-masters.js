import { prisma } from "./prisma";

export async function patientMasters() {
  const [dispensaries, superintendents, hospitals, departments] = await Promise.all([
    prisma.dispensary.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.superintendentHospital.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.hospital.findMany({ where: { isActive: true }, select: { id: true, name: true, city: true, departmentIds: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { dispensaries, superintendents, hospitals, departments };
}

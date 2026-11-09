import { prisma } from "./prisma";
import { ApiError } from "./api";
import { ageFrom } from "./format";

// Resolves who a referral is for. No familyMemberId means the employee.
export async function beneficiaryFields(employee, familyMemberId) {
  if (!familyMemberId) return { familyMemberId: null, patientName: employee.fullName, patientRelation: "Self" };
  const fm = await prisma.familyMember.findFirst({ where: { id: familyMemberId, employeeId: employee.id, isActive: true } });
  if (!fm) throw new ApiError(400, "Choose a family member from your profile.");
  return { familyMemberId: fm.id, patientName: fm.fullName, patientRelation: fm.relation };
}

// The snapshot stored at submission: card holder plus the person treated.
export async function patientSnapshot(employee, companyName, familyMemberId) {
  const fm = familyMemberId ? await prisma.familyMember.findUnique({ where: { id: familyMemberId } }) : null;
  const person = fm || employee;
  return {
    name: employee.fullName,
    employeeCode: employee.employeeCode,
    mobile: employee.mobile,
    email: employee.email,
    company: companyName,
    patient: {
      name: person.fullName,
      relation: fm ? fm.relation : "Self",
      gender: person.gender,
      age: ageFrom(person.dateOfBirth),
      dateOfBirth: person.dateOfBirth,
      bloodGroup: person.bloodGroup,
    },
    // kept for older screens
    gender: person.gender,
    age: ageFrom(person.dateOfBirth),
    bloodGroup: person.bloodGroup,
  };
}

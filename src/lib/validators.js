import { z } from "zod";
import { ApiError } from "./api";

const optStr = z.string().trim().max(500).optional().nullable().transform((v) => (v ? v : null));
const mobile = z.string().trim().transform((v) => v.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "")).refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit mobile number");
const optMobile = z.string().trim().optional().nullable().transform((v) => (v ? v.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "") : null)).refine((v) => v === null || /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit mobile number");
const optEmail = z.string().trim().toLowerCase().optional().nullable().transform((v) => (v ? v : null)).refine((v) => v === null || z.string().email().safeParse(v).success, "Enter a valid email");
const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
const optObjectId = z.string().optional().nullable().transform((v) => (v ? v : null)).refine((v) => v === null || /^[a-f0-9]{24}$/i.test(v), "Invalid id");
const date = z.coerce.date();
const optDate = z.preprocess((x) => (x === "" || x == null ? null : x), z.coerce.date().nullable()).optional();

export const v = { optStr, mobile, optMobile, optEmail, objectId, optObjectId, date, optDate };

export const companySchema = z.object({
  name: z.string().trim().min(2).max(200),
  industry: optStr,
  address: z.string().trim().min(3).max(500),
  city: z.string().trim().min(2).max(100),
  district: optStr,
  state: z.string().trim().min(2).max(100),
  pincode: z.string().trim().regex(/^\d{6}$/, "PIN code must be 6 digits"),
  gstNumber: z.string().trim().toUpperCase().optional().nullable().transform((v) => (v ? v : null)).refine((v) => v === null || /^[0-9A-Z]{15}$/.test(v), "GST number must be 15 characters"),
  hrName: optStr,
  hrMobile: optMobile,
  hrEmail: optEmail,
  dispensaryId: optObjectId,
  clusterId: optObjectId,
});

export const visitSchema = z.object({
  visitedAt: date,
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  photoKey: optStr,
  remarks: optStr,
});

export const employeeSchema = z.object({
  employeeCode: z.string().trim().min(1).max(50),
  fullName: z.string().trim().min(2).max(150),
  gender: z.enum(["Male", "Female", "Other"]),
  dateOfBirth: date.refine((d) => d < new Date() && d > new Date("1900-01-01"), "Enter a valid date of birth"),
  mobile,
  email: optEmail,
  aadhaarLast4: z.string().trim().optional().nullable().transform((v) => (v ? v : null)).refine((v) => v === null || /^\d{4}$/.test(v), "Aadhaar last 4 must be 4 digits"),
  department: optStr,
  designation: optStr,
  bloodGroup: optStr,
  address: optStr,
  emergencyName: optStr,
  emergencyMobile: optMobile,
});

// A draft accepts partial data; submit checks completeness separately.
export const familySchema = z.object({
  fullName: z.string().trim().min(2, "Enter the full name").max(150),
  relation: z.enum(["Spouse", "Son", "Daughter", "Father", "Mother", "Father-in-law", "Mother-in-law", "Brother", "Sister", "Other"]),
  gender: z.enum(["Male", "Female", "Other"]),
  dateOfBirth: date.refine((d) => d <= new Date() && d > new Date("1900-01-01"), "Enter a valid date of birth"),
  bloodGroup: optStr,
  mobile: optMobile,
});

export const referralDraftSchema = z.object({
  familyMemberId: optObjectId,
  dispensaryId: optObjectId,
  dispensaryVisitDate: optDate,
  superintendentHospitalId: optObjectId,
  superintendentName: optStr,
  referralLetterNo: optStr,
  referralDate: optDate,
  hospitalId: optObjectId,
  departmentId: optObjectId,
  diagnosis: z.string().trim().max(2000).optional().nullable().transform((v) => (v ? v : null)),
  urgency: z.enum(["ROUTINE", "URGENT", "EMERGENCY"]).default("ROUTINE"),
});

export const REQUIRED_FOR_SUBMIT = {
  dispensaryId: "Dispensary visited",
  dispensaryVisitDate: "Dispensary visit date",
  superintendentHospitalId: "Superintendent hospital",
  referralLetterNo: "Referral letter number",
  referralDate: "Referral date",
  hospitalId: "Referred to hospital",
  departmentId: "Department or speciality",
  diagnosis: "Provisional diagnosis or reason",
};

export const staffUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  mobile,
  role: z.enum(["SUPER_ADMIN", "SUDO_ADMIN", "SUPPORT", "CLUSTER_MANAGER", "HOSPITAL_USER"]),
  password: z.string().min(8, "Password must be at least 8 characters").max(100).optional().or(z.literal("")),
  clusterIds: z.array(objectId).default([]),
  hospitalId: optObjectId,
  isActive: z.boolean().default(true),
  muteWhatsapp: z.boolean().default(false),
  muteEmail: z.boolean().default(false),
});

export const masterSchemas = {
  clusters: z.object({
    name: z.string().trim().min(2).max(120),
    code: z.string().trim().toUpperCase().min(2).max(20),
    region: optStr,
    isActive: z.boolean().default(true),
  }),
  hospitals: z.object({
    name: z.string().trim().min(2).max(200),
    code: z.string().trim().toUpperCase().min(2).max(20),
    address: z.string().trim().min(3).max(500),
    city: z.string().trim().min(2),
    state: z.string().trim().min(2),
    pincode: z.string().trim().regex(/^\d{6}$/, "PIN code must be 6 digits"),
    phone: z.string().trim().min(6).max(20),
    email: z.string().trim().toLowerCase().email(),
    departmentIds: z.array(objectId).default([]),
    isActive: z.boolean().default(true),
  }),
  dispensaries: z.object({
    name: z.string().trim().min(2).max(200),
    address: optStr,
    city: optStr,
    isActive: z.boolean().default(true),
  }),
  "superintendent-hospitals": z.object({
    name: z.string().trim().min(2).max(200),
    address: optStr,
    city: optStr,
    isActive: z.boolean().default(true),
  }),
  departments: z.object({
    name: z.string().trim().min(2).max(100),
  }),
};

export const MASTER_MODELS = {
  clusters: "cluster",
  hospitals: "hospital",
  dispensaries: "dispensary",
  "superintendent-hospitals": "superintendentHospital",
  departments: "department",
};

// Masters: clusters, hospitals, dispensaries, superintendent-hospitals, departments.
export function modelFor(master) {
  const model = MASTER_MODELS[master];
  if (!model) throw new ApiError(404, "Unknown master.");
  return model;
}

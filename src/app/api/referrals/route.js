import { prisma } from "@/lib/prisma";
import { route, body, ok, ApiError, pageParams } from "@/lib/api";
import { requireApi } from "@/lib/session";
import { listReferrals } from "@/lib/referral-queries";
import { referralDraftSchema, v } from "@/lib/validators";
import { nextDraftNo } from "@/lib/counter";
import { audit } from "@/lib/audit";
import { beneficiaryFields } from "@/lib/family";

export const GET = route(async (req) => {
  const me = await requireApi();
  const url = new URL(req.url);
  const { page } = pageParams(url);
  const opts = Object.fromEntries(["status", "q", "hospitalId", "clusterId", "companyId", "from", "to"].map((k) => [k, url.searchParams.get(k) || undefined]));
  return ok(await listReferrals(me, opts, { page }));
});

// The employee, or their Cluster Manager on their behalf, starts a referral.
// It stays a Draft until submitted.
export const POST = route(async (req) => {
  const me = await requireApi(["PATIENT", "CLUSTER_MANAGER"]);
  const data = await body(req, referralDraftSchema.extend({ employeeId: v.optObjectId }));
  const { employeeId, ...draft } = data;
  let emp = me.employee;
  if (me.role === "CLUSTER_MANAGER") {
    if (!employeeId) throw new ApiError(400, "Choose the employee.");
    emp = await prisma.employee.findUnique({ where: { id: employeeId }, include: { company: { select: { id: true, name: true, clusterId: true, isActive: true } } } });
    if (!emp || !me.clusterIds.includes(emp.company?.clusterId)) throw new ApiError(404, "Employee not found in your cluster.");
    if (!emp.isActive) throw new ApiError(409, "This employee is inactive.");
  }
  if (emp.approvalStatus === "PENDING") throw new ApiError(403, "Your registration is waiting for approval by your Cluster Manager.");
  if (!emp.company?.isActive) throw new ApiError(403, "Your company is not active on SUSALI. Contact your Cluster Manager.");
  const who = await beneficiaryFields(emp, draft.familyMemberId);
  const r = await prisma.referral.create({
    data: {
      ...draft,
      ...who,
      raisedById: me.role === "CLUSTER_MANAGER" ? me.id : null,
      referralNo: await nextDraftNo(),
      employeeId: emp.id,
      companyId: emp.companyId,
      clusterId: emp.company.clusterId,
      status: "DRAFT",
    },
  });
  await prisma.referralStatusHistory.create({
    data: me.role === "CLUSTER_MANAGER"
      ? { referralId: r.id, toStatus: "DRAFT", actorUserId: me.id, remarks: `Raised by Cluster Manager on behalf of ${emp.fullName}` }
      : { referralId: r.id, toStatus: "DRAFT", actorIsPatient: true, remarks: "Draft started" },
  });
  await audit({ actor: me, action: "CREATE", entity: "Referral", entityId: r.id, req });
  return ok({ referral: r }, { status: 201 });
});

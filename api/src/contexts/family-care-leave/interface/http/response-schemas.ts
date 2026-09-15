import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** ===== family-care-leave ===== */
export const zAppFamilyCareLeave = z.object({
  id: z.string(),
  employee_id: zEmployeeId,
  leave_kind: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  note: z.string().nullable(),
  status: z.enum(["requested", "approved", "cancelled"]),
  created_at: z.string(),
})

export const zAppFamilyCareLeaveList = z.object({
  data: z.array(zAppFamilyCareLeave),
  total: z.number(),
})

export const familyCareLeaveSourceFreezeResponseSchema = z.strictObject({ freeze: recordSourceFreezeSnapshotSchema })

export const zAppFamilyCareLeaveCoveragePageReceipt = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/), afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(), checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})

export const zAppFamilyCareLeaveRetirementPlan = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(), recordKinds: z.array(z.literal("family-care-leave-record")),
  createdAt: z.iso.datetime(),
})

export const zAppFamilyCareLeaveRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(), planId: z.uuid(), planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(), checkedAt: z.iso.datetime(),
})

export const zAppFamilyCareLeaveRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(), caseId: z.string().min(1), planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/), status: z.string().min(1),
})

export const zAppFamilyCareLeaveRetirementExecution = z.strictObject({
  retirement_id: z.uuid(), finalized_at: z.iso.datetime(),
})

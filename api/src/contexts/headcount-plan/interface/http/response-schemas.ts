import { z } from "zod"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"

/** 人員計画 1 件のレスポンス。actual_count は同部署の active 在籍数。 */
export const zAppHeadcountPlan = z.object({
  id: z.number(),
  fiscal_year: z.number(),
  department_code: z.string().nullable(),
  planned_count: z.number(),
  actual_count: z.number(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 人員計画一覧のレスポンス。 */
export const zAppHeadcountPlanList = z.object({
  data: z.array(zAppHeadcountPlan),
  total: z.number(),
})

export const headcountPlanSourceFreezeResponseSchema = z.strictObject({ freeze: recordSourceFreezeSnapshotSchema })

export const zAppHeadcountPlanCoveragePageReceipt = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/), afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(), checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})

export const zAppHeadcountPlanRetirementPlan = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(), recordKinds: z.array(z.literal("headcount-plan-record")),
  createdAt: z.iso.datetime(),
})

export const zAppHeadcountPlanRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(), planId: z.uuid(), planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(), checkedAt: z.iso.datetime(),
})

export const zAppHeadcountPlanRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(), caseId: z.string().min(1), planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/), status: z.string().min(1),
})

export const zAppHeadcountPlanRetirementExecution = z.strictObject({
  retirement_id: z.uuid(), finalized_at: z.iso.datetime(),
})

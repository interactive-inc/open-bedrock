import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"

/** 従業員の勤務形態の 1 区分（期間つき）。制度の適法性判定はしない。 */
export const zAppEmployeeWorkStyle = z.object({
  id: z.uuid(),
  employee_id: zEmployeeId,
  style: z.enum(["regular", "flextime", "discretionary", "shift"]),
  starts_on: z.string(),
  ends_on: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

/** 従業員の勤務形態一覧のレスポンス。 */
export const zAppEmployeeWorkStyleList = z.object({
  data: z.array(zAppEmployeeWorkStyle),
  total: z.number(),
})

export const employeeWorkStyleSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

export const zAppEmployeeWorkStyleCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})

export const zAppEmployeeWorkStyleRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(z.literal("employee-work-style-record")),
  createdAt: z.iso.datetime(),
})

export const zAppEmployeeWorkStyleRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})

export const zAppEmployeeWorkStyleRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})

export const zAppEmployeeWorkStyleRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})

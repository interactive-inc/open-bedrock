import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"

/** 懲戒の記録 1 件のレスポンス（非公開。本人にも見せない設計）。 */
export const zAppDisciplinaryAction = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  kind: z.string(),
  summary: z.string(),
  decided_on: z.string(),
  created_at: z.string(),
})

/** 懲戒の記録一覧のレスポンス。 */
export const zAppDisciplinaryActionList = z.object({
  data: z.array(zAppDisciplinaryAction),
  total: z.number(),
})

export const disciplinaryActionSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

export const zAppDisciplinaryActionCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})

export const zAppDisciplinaryActionRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(z.literal("disciplinary-action-record")),
  createdAt: z.iso.datetime(),
})

export const zAppDisciplinaryActionRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})

export const zAppDisciplinaryActionRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})

export const zAppDisciplinaryActionRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})

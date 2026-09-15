import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { lifeEventTypeSchema } from "@/contexts/life-event/domain/definitions/life-event-type.definition"
import { z } from "zod"

/** ===== life-event ===== */
export const zAppLifeEvent = z.object({
  id: z.string(),
  employee_id: zEmployeeId,
  event_type: lifeEventTypeSchema,
  event_date: z.string(),
  detail: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export const zAppLifeEventList = z.object({
  data: z.array(zAppLifeEvent),
  total: z.number(),
})

export const lifeEventSourceFreezeResponseSchema = z.strictObject({ freeze: recordSourceFreezeSnapshotSchema })

export const zAppLifeEventCoveragePageReceipt = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/), afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(), checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})

export const zAppLifeEventRetirementPlan = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(), recordKinds: z.array(z.literal("life-event-record")),
  createdAt: z.iso.datetime(),
})

export const zAppLifeEventRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(), planId: z.uuid(), planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(), checkedAt: z.iso.datetime(),
})

export const zAppLifeEventRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(), caseId: z.string().min(1), planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/), status: z.string().min(1),
})

export const zAppLifeEventRetirementExecution = z.strictObject({
  retirement_id: z.uuid(), finalized_at: z.iso.datetime(),
})

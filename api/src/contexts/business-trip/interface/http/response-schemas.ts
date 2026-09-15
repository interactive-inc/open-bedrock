import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"

/** ===== business-trip ===== */
export const zAppBusinessTrip = z.object({
  id: z.string(),
  traveler_id: zEmployeeId,
  destination: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  purpose: z.string(),
  estimated_cost: z.number().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export type AppBusinessTrip = z.infer<typeof zAppBusinessTrip>

export const zAppBusinessTripList = z.object({
  data: z.array(zAppBusinessTrip),
  total: z.number(),
})

export const businessTripSourceFreezeResponseSchema = z.strictObject({ freeze: recordSourceFreezeSnapshotSchema })

export const zAppBusinessTripCoveragePageReceipt = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/), afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(), checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})

export const zAppBusinessTripRetirementPlan = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(), recordKinds: z.array(z.literal("business-trip-record")),
  createdAt: z.iso.datetime(),
})

export const zAppBusinessTripRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(), planId: z.uuid(), planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(), checkedAt: z.iso.datetime(),
})

export const zAppBusinessTripRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(), caseId: z.string().min(1), planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/), status: z.string().min(1),
})

export const zAppBusinessTripRetirementExecution = z.strictObject({
  retirement_id: z.uuid(), finalized_at: z.iso.datetime(),
})

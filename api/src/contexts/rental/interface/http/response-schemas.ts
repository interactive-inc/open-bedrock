import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import { z } from "zod"

/** ===== rental ===== */
export const zAppRentalReservation = z.object({
  id: z.string(),
  requester_id: zEmployeeId,
  item_name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  purpose: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export const zAppRentalReservationList = z.object({
  data: z.array(zAppRentalReservation),
  total: z.number(),
})

export const rentalReservationSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

export const zAppRentalReservationCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})

export const zAppRentalReservationRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(z.literal("rental-reservation-record")),
  createdAt: z.iso.datetime(),
})

export const zAppRentalReservationRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})

export const zAppRentalReservationRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})

export const zAppRentalReservationRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})

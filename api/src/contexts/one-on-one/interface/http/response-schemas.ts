import { z } from "zod"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"

/** 1on1 1 件のレスポンス。参加者名込み。 */
export const zAppOneOnOne = z.object({
  id: z.string(),
  held_at: z.string(),
  member_name: z.string(),
  manager_name: z.string(),
  topics: z.string().nullable(),
  manager_note: z.string().nullable(),
  next_action: z.string().nullable(),
})

/** 1on1 一覧のレスポンス。 */
export const zAppOneOnOneList = z.object({
  data: z.array(zAppOneOnOne),
  total: z.number(),
})

export const oneOnOneSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

export const zAppOneOnOneCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})

export const zAppOneOnOneRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(z.literal("one-on-one-record")),
  createdAt: z.iso.datetime(),
})

export const zAppOneOnOneRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})

export const zAppOneOnOneRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})

export const zAppOneOnOneRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})

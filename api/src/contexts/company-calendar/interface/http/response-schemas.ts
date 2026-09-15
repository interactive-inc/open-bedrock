import { z } from "zod"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"

/** 会社カレンダーの 1 日（会社休日 / 振替出勤日）。通常営業日は含まない。 */
export const zAppCompanyCalendarDay = z.object({
  id: z.number(),
  calendar_date: z.string(),
  kind: z.enum(["holiday", "workday"]),
  name: z.string().nullable(),
  created_at: z.string(),
})

/** 会社カレンダー一覧のレスポンス。 */
export const zAppCompanyCalendarDayList = z.object({
  data: z.array(zAppCompanyCalendarDay),
  total: z.number(),
})

export const companyCalendarDaySourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

export const zAppCompanyCalendarDayCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})

export const zAppCompanyCalendarDayRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(z.literal("company-calendar-record")),
  createdAt: z.iso.datetime(),
})

export const zAppCompanyCalendarDayRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})

export const zAppCompanyCalendarDayRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})

export const zAppCompanyCalendarDayRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})

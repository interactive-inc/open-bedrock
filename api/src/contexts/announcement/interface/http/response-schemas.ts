import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"

/** 社内アナウンス一覧の 1 件。 */
export const zAppAnnouncementListItem = z.object({
  id: z.uuid(),
  title: z.string(),
  status: z.string(),
  published_on: z.string().nullable(),
  author_employee_id: zEmployeeId,
  created_at: z.string(),
})

/** 社内アナウンス一覧のレスポンス。 */
export const zAppAnnouncementList = z.object({
  data: z.array(zAppAnnouncementListItem),
  total: z.number(),
})

/** 社内アナウンス 1 件の詳細・作成・更新レスポンス。 */
export const zAppAnnouncement = z.object({
  id: z.uuid(),
  title: z.string(),
  body_md: z.string(),
  status: z.string(),
  published_on: z.string().nullable(),
  author_employee_id: zEmployeeId,
  created_at: z.string(),
})

/** アナウンス原記録の書込み停止世代。 */
export const announcementSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

export const zAppAnnouncementCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})

export const zAppAnnouncementRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(z.literal("announcement-record")),
  createdAt: z.iso.datetime(),
})

export const zAppAnnouncementRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})

export const zAppAnnouncementRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})

export const zAppAnnouncementRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})

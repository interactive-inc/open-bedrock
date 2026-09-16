import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import { meetingRecordKindSchema } from "@/contexts/meeting/domain/definitions/meeting-record-kind.definition"
import { z } from "zod"

export const meetingSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

export const zAppMeetingCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})
export const zAppMeetingRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(meetingRecordKindSchema).length(3),
  createdAt: z.iso.datetime(),
})
export const zAppMeetingRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})
export const zAppMeetingRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})
export const zAppMeetingRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})

/** 会議体 1 件のレスポンス（詳細・作成・更新）。 */
export const zAppMeeting = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  cadence: z.string().nullable(),
  description: z.string().nullable(),
  status: z.enum(["active", "archived"]),
  created_at: z.string(),
})

/** 会議体一覧のレスポンス。 */
export const zAppMeetingList = z.object({
  data: z.array(zAppMeeting),
  total: z.number(),
})

/** 議事録 1 件のレスポンス（詳細・作成・更新）。 */
export const zAppMeetingMinutes = z.object({
  id: z.number(),
  meeting_id: z.number(),
  held_on: z.string(),
  title: z.string(),
  attendees: z.string().nullable(),
  body_md: z.string(),
  author_employee_id: zEmployeeId,
  created_at: z.string(),
})

/** 議事録一覧のレスポンス。 */
export const zAppMeetingMinutesList = z.object({
  data: z.array(zAppMeetingMinutes),
  total: z.number(),
})

/** 意思決定記録 1 件のレスポンス（詳細・作成・更新・supersede）。 */
export const zAppDecision = z.object({
  id: z.number(),
  title: z.string(),
  decided_on: z.string(),
  context: z.string(),
  decision: z.string(),
  consequences: z.string().nullable(),
  status: z.enum(["active", "superseded"]),
  superseded_by_id: z.number().nullable(),
  created_at: z.string(),
})

/** 意思決定記録一覧のレスポンス。 */
export const zAppDecisionList = z.object({
  data: z.array(zAppDecision),
  total: z.number(),
})

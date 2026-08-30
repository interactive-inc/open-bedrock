import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

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

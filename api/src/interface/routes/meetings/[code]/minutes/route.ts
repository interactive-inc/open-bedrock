import { CreateMeetingMinutes } from "@/application/meeting/create-meeting-minutes"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { validateCodeParam } from "@/interface/utils/validate-code-param"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppMeetingMinutes, zAppMeetingMinutesList } from "@/lib/app-schemas"
import { meetingMinutes, meetings } from "@/schema"
import { count, desc, eq } from "drizzle-orm"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /meetings/:code/minutes — 会議体配下の議事録一覧（全認証者） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null) {
    throw new UnauthorizedError()
  }

  const code = validateCodeParam(c.req.param("code"), "meeting")

  const meetingRows = await c.var.database
    .select()
    .from(meetings)
    .where(eq(meetings.code, code))
    .limit(1)

  const meeting = meetingRows.at(0)

  if (meeting === undefined) {
    throw new NotFoundError("meeting not found")
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const [rows, totalRows] = await Promise.all([
    c.var.database
      .select()
      .from(meetingMinutes)
      .where(eq(meetingMinutes.meetingId, meeting.id))
      .orderBy(desc(meetingMinutes.heldOn), desc(meetingMinutes.id))
      .limit(limit)
      .offset(offset),
    c.var.database
      .select({ total: count() })
      .from(meetingMinutes)
      .where(eq(meetingMinutes.meetingId, meeting.id)),
  ])

  const responseBody = zAppMeetingMinutesList.parse({
    data: rows.map((row) => ({
      id: row.id,
      meeting_id: row.meetingId,
      held_on: row.heldOn,
      title: row.title,
      attendees: row.attendees,
      body_md: row.bodyMd,
      author_employee_id: row.authorEmployeeId,
      created_at: row.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})

// @authorization authenticated - ログインしていれば誰でも書ける共有データ
/**
 * POST /meetings/:code/minutes — 議事録を記録（全認証者。記録文化を阻害しない）
 *
 * 会議体の所属・権限を問わないため、任意の認証者が任意の会議体に記録を足せる。
 * 作成後の訂正は作成者本人か meeting:manage に限定される（PUT 側）。
 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      held_on: z.string().min(1).max(64),
      title: z.string().min(1).max(500),
      attendees: z.string().max(2_000).nullable().optional(),
      body_md: z.string().min(1).max(50_000),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const code = validateCodeParam(c.req.param("code"), "meeting")

    const json = c.req.valid("json")

    const created = await new CreateMeetingMinutes(c).run({
      meetingCode: code,
      heldOn: json.held_on,
      title: json.title,
      attendees: json.attendees ?? null,
      bodyMd: json.body_md,
      authorEmployeeId: session.employeeId,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppMeetingMinutes.parse({
      id: created.id,
      meeting_id: created.meetingId,
      held_on: created.heldOn,
      title: created.title,
      attendees: created.attendees,
      body_md: created.bodyMd,
      author_employee_id: created.authorEmployeeId,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)

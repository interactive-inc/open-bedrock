import { UpdateMeetingMinutes } from "@/application/meeting/update-meeting-minutes"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppMeetingMinutes } from "@/lib/app-schemas"
import { meetingMinutes } from "@/schema"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /meeting-minutes-records/:id — 議事録の詳細（全認証者） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null) {
    throw new UnauthorizedError()
  }

  const minutesId = validateIntParam(c.req.param("id"), "minutes")

  const rows = await c.var.database
    .select()
    .from(meetingMinutes)
    .where(eq(meetingMinutes.id, minutesId))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("minutes not found")
  }

  const responseBody = zAppMeetingMinutes.parse({
    id: row.id,
    meeting_id: row.meetingId,
    held_on: row.heldOn,
    title: row.title,
    attendees: row.attendees,
    body_md: row.bodyMd,
    author_employee_id: row.authorEmployeeId,
    created_at: row.createdAt,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** PUT /meeting-minutes-records/:id — 議事録を更新（作成者本人 or meeting:manage） */
export const PUT = factory.createHandlers(
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

    const minutesId = validateIntParam(c.req.param("id"), "minutes")

    const json = c.req.valid("json")

    const updated = await new UpdateMeetingMinutes(c).run({
      session: session,
      minutesId: minutesId,
      heldOn: json.held_on,
      title: json.title,
      attendees: json.attendees ?? null,
      bodyMd: json.body_md,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppMeetingMinutes.parse({
      id: updated.id,
      meeting_id: updated.meetingId,
      held_on: updated.heldOn,
      title: updated.title,
      attendees: updated.attendees,
      body_md: updated.bodyMd,
      author_employee_id: updated.authorEmployeeId,
      created_at: updated.createdAt,
    })

    return c.json(responseBody, 200)
  },
)

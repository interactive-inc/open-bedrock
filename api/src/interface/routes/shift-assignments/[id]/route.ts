import { DeleteShiftAssignment } from "@/application/shift/delete-shift-assignment"
import { GetShiftAssignment } from "@/application/shift/get-shift-assignment"
import { UpdateShiftAssignment } from "@/application/shift/update-shift-assignment"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppShiftAssignment } from "@/lib/app-schemas"
import type { ShiftAssignment } from "@/domain/shift/shift-assignment.entity"
import { factory } from "@/interface/utils/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { codeSchema } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 割当をレスポンス用の snake_case に整形する。 */
function toResponseBody(assignment: ShiftAssignment) {
  return zAppShiftAssignment.parse({
    id: assignment.id,
    employee_id: assignment.employeeId,
    pattern_id: assignment.patternId,
    date: assignment.date,
    note: assignment.note,
    published_at: assignment.publishedAt,
  })
}

// @authorization service - session を application service に渡して判定する
/** GET /shift-assignments/:id — シフト割当の詳細（特権ロール） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const assignmentId = validateIntParam(c.req.param("id"), "shift assignment")

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const assignment = await new GetShiftAssignment(c).run({
    session: session,
    assignmentId,
  })

  if (assignment instanceof ApplicationError) {
    throw toHttpException(assignment)
  }

  return c.json(toResponseBody(assignment), 200)
})

// @authorization service - session を application service に渡して判定する
/** PUT /shift-assignments/:id — シフト割当のパターン・日付・備考を変更（特権ロール） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      pattern_code: codeSchema.nullable().optional(),
      date: isoDate,
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const assignmentId = validateIntParam(c.req.param("id"), "shift assignment")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const assignment = await new UpdateShiftAssignment(c).run({
      session: session,
      assignmentId,
      patternCode: json.pattern_code ?? null,
      date: json.date,
      note: json.note ?? null,
    })

    if (assignment instanceof ApplicationError) {
      throw toHttpException(assignment)
    }

    return c.json(toResponseBody(assignment), 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** DELETE /shift-assignments/:id — シフト割当を削除（特権ロール） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const assignmentId = validateIntParam(c.req.param("id"), "shift assignment")

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteShiftAssignment(c).run({
    session: session,
    assignmentId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})

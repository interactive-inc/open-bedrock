import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { ShiftAssignmentRepository } from "@/contexts/shift/infrastructure/repositories/shift-assignment.repository"
import { DeleteShiftAssignment } from "@/contexts/shift/application/delete-shift-assignment"
import { UpdateShiftAssignment } from "@/contexts/shift/application/update-shift-assignment"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppShiftAssignment } from "@/contexts/shift/interface/http/response-schemas"
import type { ShiftAssignment } from "@/contexts/shift/domain/entities/shift-assignment.entity"
import { factory } from "@/api/http/factory"
import { isoDate } from "@/lib/validation/iso-date.schema"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { codeSchema } from "@/lib/validation/code.schema"
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

  const assignment = await (async () => {
    const input = {
      session: session,
      assignmentId,
    }

    if (input.session.hasPermission("shift:manage") === false) {
      return new ForbiddenError("cannot manage shift", "forbidden")
    }

    const assignmentRepository = new ShiftAssignmentRepository(c)

    const assignment = await assignmentRepository.findById(input.assignmentId)

    if (assignment instanceof Error) {
      return new UnexpectedError("failed to find shift assignment", { cause: assignment })
    }

    if (assignment === null) {
      return new NotFoundError("shift assignment not found", "assignment_not_found")
    }

    return assignment
  })()

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

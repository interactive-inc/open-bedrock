import { DeleteShiftAssignment } from "@/application/shift/delete-shift-assignment"
import { GetShiftAssignment } from "@/application/shift/get-shift-assignment"
import { UpdateShiftAssignment } from "@/application/shift/update-shift-assignment"
import type { ShiftAssignment } from "@/domain/shift/shift-assignment"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 割当をレスポンス用の snake_case に整形する。
function toResponseBody(assignment: ShiftAssignment) {
  return {
    id: assignment.id,
    employee_id: assignment.employeeId,
    pattern_id: assignment.patternId,
    date: assignment.date,
    note: assignment.note,
    published_at: assignment.publishedAt,
  }
}

// GET /shift/assignments/:id — シフト割当の詳細（特権ロール）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const assignmentId = Number(c.req.param("id") ?? "")

  if (Number.isInteger(assignmentId) === false) {
    throw new BadRequestError("invalid assignment id")
  }

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const assignment = await new GetShiftAssignment(c).run({
    viewerRole: session.role,
    assignmentId,
  })

  if (assignment instanceof Error) {
    throw new InternalError("failed to load assignment")
  }

  if ("reason" in assignment) {
    if (assignment.reason === "forbidden") {
      throw new ForbiddenError()
    }

    throw new NotFoundError("assignment not found")
  }

  return c.json(toResponseBody(assignment), 200)
})

// PUT /shift/assignments/:id — シフト割当のパターン・日付・備考を変更（特権ロール）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      pattern_code: z.string().nullable().optional(),
      date: z.string().min(1),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const assignmentId = Number(c.req.param("id") ?? "")

    if (Number.isInteger(assignmentId) === false) {
      throw new BadRequestError("invalid assignment id")
    }

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const assignment = await new UpdateShiftAssignment(c).run({
      viewerRole: session.role,
      assignmentId,
      patternCode: json.pattern_code ?? null,
      date: json.date,
      note: json.note ?? null,
    })

    if (assignment instanceof Error) {
      throw new InternalError("failed to update assignment")
    }

    if ("reason" in assignment) {
      if (assignment.reason === "forbidden") {
        throw new ForbiddenError()
      }

      if (assignment.reason === "pattern_not_found") {
        throw new NotFoundError("pattern not found")
      }

      throw new NotFoundError("assignment not found")
    }

    return c.json(toResponseBody(assignment), 200)
  },
)

// DELETE /shift/assignments/:id — シフト割当を削除（特権ロール）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const assignmentId = Number(c.req.param("id") ?? "")

  if (Number.isInteger(assignmentId) === false) {
    throw new BadRequestError("invalid assignment id")
  }

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteShiftAssignment(c).run({
    viewerRole: session.role,
    assignmentId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to delete assignment")
  }

  if (result.reason === "forbidden") {
    throw new ForbiddenError()
  }

  if (result.reason === "assignment_not_found") {
    throw new NotFoundError("assignment not found")
  }

  return c.body(null, 204)
})

import { DeleteShiftPattern } from "@/application/shift/delete-shift-pattern"
import { GetShiftPattern } from "@/application/shift/get-shift-pattern"
import { UpdateShiftPattern } from "@/application/shift/update-shift-pattern"
import type { ShiftPattern } from "@/domain/shift/shift-pattern"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

// パターンをレスポンス用の snake_case に整形する。
function toResponseBody(pattern: ShiftPattern) {
  return {
    id: pattern.id,
    code: pattern.code,
    name: pattern.name,
    start_time: pattern.startTime,
    end_time: pattern.endTime,
    break_minutes: pattern.breakMinutes,
  }
}

// GET /shift/patterns/:id — シフトパターンの詳細（特権ロール）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const patternId = Number(c.req.param("id") ?? "")

  if (Number.isInteger(patternId) === false) {
    throw new BadRequestError("invalid pattern id")
  }

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const pattern = await new GetShiftPattern(c).run({
    viewerRole: session.role,
    patternId,
  })

  if (pattern instanceof Error) {
    throw new InternalError("failed to load pattern")
  }

  if ("reason" in pattern) {
    if (pattern.reason === "forbidden") {
      throw new ForbiddenError()
    }

    throw new NotFoundError("pattern not found")
  }

  return c.json(toResponseBody(pattern), 200)
})

// PUT /shift/patterns/:id — シフトパターンの内容を変更（特権ロール）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: codeSchema,
      name: z.string().min(1).max(200),
      start_time: z.string().min(1),
      end_time: z.string().min(1),
      break_minutes: z.number().int().nonnegative().default(0),
    }),
  ),
  async (c) => {
    const patternId = Number(c.req.param("id") ?? "")

    if (Number.isInteger(patternId) === false) {
      throw new BadRequestError("invalid pattern id")
    }

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const pattern = await new UpdateShiftPattern(c).run({
      viewerRole: session.role,
      patternId,
      code: json.code,
      name: json.name,
      startTime: json.start_time,
      endTime: json.end_time,
      breakMinutes: json.break_minutes,
    })

    if (pattern instanceof Error) {
      throw new InternalError("failed to update pattern")
    }

    if ("reason" in pattern) {
      if (pattern.reason === "forbidden") {
        throw new ForbiddenError()
      }

      if (pattern.reason === "code_conflict") {
        throw new ConflictError("pattern code already exists")
      }

      throw new NotFoundError("pattern not found")
    }

    return c.json(toResponseBody(pattern), 200)
  },
)

// DELETE /shift/patterns/:id — シフトパターンを削除（特権ロール）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const patternId = Number(c.req.param("id") ?? "")

  if (Number.isInteger(patternId) === false) {
    throw new BadRequestError("invalid pattern id")
  }

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteShiftPattern(c).run({
    viewerRole: session.role,
    patternId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to delete pattern")
  }

  if (result.reason === "forbidden") {
    throw new ForbiddenError()
  }

  if (result.reason === "pattern_in_use") {
    throw new ConflictError("pattern is in use by assignments")
  }

  if (result.reason === "pattern_not_found") {
    throw new NotFoundError("pattern not found")
  }

  return c.body(null, 204)
})

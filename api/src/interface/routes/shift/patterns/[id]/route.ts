import { DeleteShiftPattern } from "@/application/shift/delete-shift-pattern"
import { GetShiftPattern } from "@/application/shift/get-shift-pattern"
import { UpdateShiftPattern } from "@/application/shift/update-shift-pattern"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppShiftPattern } from "@/lib/app-schemas"
import type { ShiftPattern } from "@/domain/shift/shift-pattern.entity"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

/** パターンをレスポンス用の snake_case に整形する。 */
function toResponseBody(pattern: ShiftPattern) {
  return zAppShiftPattern.parse({
    id: pattern.id,
    code: pattern.code,
    name: pattern.name,
    start_time: pattern.startTime,
    end_time: pattern.endTime,
    break_minutes: pattern.breakMinutes,
  })
}

/** GET /shift/patterns/:id — シフトパターンの詳細（特権ロール） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const patternId = validateIntParam(c.req.param("id"), "shift pattern")

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const pattern = await new GetShiftPattern(c).run({
    session: session,
    patternId,
  })

  if (pattern instanceof ApplicationError) {
    throw toHttpException(pattern)
  }

  return c.json(toResponseBody(pattern), 200)
})

/** PUT /shift/patterns/:id — シフトパターンの内容を変更（特権ロール） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: codeSchema,
      name: z.string().min(1).max(200),
      start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
        message: "start_time must be in HH:MM format",
      }),
      end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
        message: "end_time must be in HH:MM format",
      }),
      break_minutes: z.number().int().nonnegative().default(0),
    }),
  ),
  async (c) => {
    const patternId = validateIntParam(c.req.param("id"), "shift pattern")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const pattern = await new UpdateShiftPattern(c).run({
      session: session,
      patternId,
      code: json.code,
      name: json.name,
      startTime: json.start_time,
      endTime: json.end_time,
      breakMinutes: json.break_minutes,
    })

    if (pattern instanceof ApplicationError) {
      throw toHttpException(pattern)
    }

    return c.json(toResponseBody(pattern), 200)
  },
)

/** DELETE /shift/patterns/:id — シフトパターンを削除（特権ロール） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const patternId = validateIntParam(c.req.param("id"), "shift pattern")

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteShiftPattern(c).run({
    session: session,
    patternId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})

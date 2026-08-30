import { ForbiddenError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { CreateShiftPattern } from "@/contexts/shift/application/create-shift-pattern"
import { shiftPatterns } from "@/contexts/shift/infrastructure/schema/shift"
import {
  zAppShiftPattern,
  zAppShiftPatternList,
} from "@/contexts/shift/interface/http/response-schemas"
import { ApplicationError } from "@/lib/errors"
import { codeSchema } from "@/lib/validation/code.schema"
import { zValidator } from "@hono/zod-validator"
import { count } from "drizzle-orm"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /shift-patterns — 特権ロールがシフトパターンを新規作成する */
export const POST = factory.createHandlers(
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
    const request = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const pattern = await new CreateShiftPattern(c).run({
      session: session,
      pattern: {
        code: request.code,
        name: request.name,
        startTime: request.start_time,
        endTime: request.end_time,
        breakMinutes: request.break_minutes,
      },
    })

    if (pattern instanceof ApplicationError) {
      throw toHttpException(pattern)
    }

    const responseBody = zAppShiftPattern.parse({
      id: pattern.id,
      code: pattern.code,
      name: pattern.name,
      start_time: pattern.startTime,
      end_time: pattern.endTime,
      break_minutes: pattern.breakMinutes,
    })

    return c.json(responseBody, 201)
  },
)

// @authorization permission - 権限キーで判定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("shift:manage") === false) {
    throw new ForbiddenError()
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

  const rows = await c.var.database
    .select()
    .from(shiftPatterns)
    .orderBy(shiftPatterns.id)
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database.select({ total: count() }).from(shiftPatterns)

  const responseBody = zAppShiftPatternList.parse({
    data: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      start_time: row.startTime,
      end_time: row.endTime,
      break_minutes: row.breakMinutes,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})

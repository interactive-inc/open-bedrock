import { CreateShiftPattern } from "@/application/shift/create-shift-pattern"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

// POST /shift/patterns — 特権ロールがシフトパターンを新規作成する
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
      viewerRole: session.role,
      pattern: {
        code: request.code,
        name: request.name,
        startTime: request.start_time,
        endTime: request.end_time,
        breakMinutes: request.break_minutes,
      },
    })

    if (pattern instanceof Error) {
      throw new InternalError("failed to create pattern")
    }

    if ("reason" in pattern) {
      if (pattern.reason === "forbidden") {
        throw new ForbiddenError()
      }

      throw new ConflictError("pattern code already exists")
    }

    const responseBody = {
      id: pattern.id,
      code: pattern.code,
      name: pattern.name,
      start_time: pattern.startTime,
      end_time: pattern.endTime,
      break_minutes: pattern.breakMinutes,
    }

    return c.json(responseBody, 201)
  },
)

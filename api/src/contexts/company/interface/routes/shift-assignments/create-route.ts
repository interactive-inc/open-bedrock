import { CreateShiftAssignment } from "@/contexts/company/application/shift/create-shift-assignment"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppShiftAssignment } from "@/lib/app-schemas"
import { factory } from "@/contexts/company/interface/utils/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

// @authorization service - session を application service に渡して判定する
/** POST /shift-assignments — 特権ロールが下書きのシフト割当を作成する */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      employee_code: codeSchema,
      pattern_code: codeSchema,
      date: isoDate,
      note: z.string().max(3_000).optional(),
    }),
  ),
  async (c) => {
    const request = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const assignment = await new CreateShiftAssignment(c).run({
      session: session,
      employeeCode: request.employee_code,
      patternCode: request.pattern_code,
      date: request.date,
      note: request.note ?? null,
    })

    if (assignment instanceof ApplicationError) {
      throw toHttpException(assignment)
    }

    const responseBody = zAppShiftAssignment.parse({
      id: assignment.id,
      employee_id: assignment.employeeId,
      pattern_id: assignment.patternId,
      date: assignment.date,
      note: assignment.note,
      published_at: assignment.publishedAt,
    })

    return c.json(responseBody, 201)
  },
)

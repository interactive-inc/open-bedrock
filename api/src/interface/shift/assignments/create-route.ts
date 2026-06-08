import { CreateShiftAssignment } from "@/application/shift/create-shift-assignment"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// POST /shift/assignments — 特権ロールが下書きのシフト割当を作成する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      employee_code: z.string().min(1),
      pattern_code: z.string().min(1),
      date: z.string().min(1),
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
      viewerRole: session.role,
      employeeCode: request.employee_code,
      patternCode: request.pattern_code,
      date: request.date,
      note: request.note ?? null,
    })

    if (assignment instanceof Error) {
      throw new InternalError("failed to create assignment")
    }

    if ("reason" in assignment) {
      if (assignment.reason === "forbidden") {
        throw new ForbiddenError()
      }

      if (assignment.reason === "employee_not_found") {
        throw new NotFoundError("employee not found")
      }

      throw new NotFoundError("pattern not found")
    }

    const responseBody = {
      id: assignment.id,
      employee_id: assignment.employeeId,
      pattern_id: assignment.patternId,
      date: assignment.date,
      note: assignment.note,
      published_at: assignment.publishedAt,
    }

    return c.json(responseBody, 201)
  },
)

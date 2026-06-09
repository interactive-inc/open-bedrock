import { CreateLeaveRequest } from "@/application/leave/create-leave-request"
import {
  BadRequestError,
  ConflictError,
  InternalError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// POST /leave/requests — 本人として休暇申請を作成
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      leave_type: z.enum(["annual", "special"]),
      start_date: isoDate,
      end_date: isoDate,
      reason: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const body = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const created = await new CreateLeaveRequest(c).run({
      employeeId: session.employeeId,
      leaveType: body.leave_type,
      startDate: body.start_date,
      endDate: body.end_date,
      reason: body.reason ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof Error) {
      throw new InternalError("failed to create leave request")
    }

    if ("failure" in created) {
      if (created.failure === "overlapping_leave_request") {
        throw new ConflictError("an overlapping leave request already exists")
      }

      throw new BadRequestError("invalid leave period")
    }

    const responseBody = {
      id: created.id,
      employeeId: created.employeeId,
      leaveType: created.leaveType,
      startDate: created.startDate,
      endDate: created.endDate,
      days: created.days,
      reason: created.reason,
      status: created.status,
      approverId: created.approverId,
      decidedComment: created.decidedComment,
      createdAt: created.createdAt,
    }

    return c.json(responseBody, 201)
  },
)

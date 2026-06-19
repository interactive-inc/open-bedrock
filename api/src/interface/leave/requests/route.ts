import { CreateLeaveRequest } from "@/application/leave/create-leave-request"
import { LeaveRequest } from "@/domain/leave/leave-request.entity"
import {
  BadRequestError,
  ConflictError,
  InternalError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { factory } from "@/lib/factory"
import { isoDate, leaveTypeSchema } from "@/lib/schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// POST /leave/requests — 本人として休暇申請を作成
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        leave_type: leaveTypeSchema,
        start_date: isoDate,
        end_date: isoDate,
        reason: z.string().max(3_000).nullable().optional(),
      })
      .refine((d) => d.start_date <= d.end_date, {
        message: "end_date must be on or after start_date",
        path: ["end_date"],
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

    if (created instanceof LeaveRequest) {
      const responseBody = {
        id: created.id,
        employee_id: created.employeeId,
        leave_type: created.leaveType,
        start_date: created.startDate,
        end_date: created.endDate,
        days: created.days,
        reason: created.reason,
        status: created.status,
        approver_id: created.approverId,
        decided_comment: created.decidedComment,
        created_at: created.createdAt,
      }

      return c.json(responseBody, 201)
    }

    if (created.reason === "overlapping_leave_request") {
      throw new ConflictError("an overlapping leave request already exists")
    }

    throw new BadRequestError("invalid leave period")
  },
)

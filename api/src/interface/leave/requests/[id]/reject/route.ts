import { DecideLeaveRequest } from "@/application/leave/decide-leave-request"
import { canDecideLeave } from "@/domain/leave/can-decide-leave"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// POST /leave/requests/:id/reject — 休暇申請を却下する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      comment: z.string().max(3_000).nullable(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (canDecideLeave(session.role) === false) {
      throw new ForbiddenError()
    }

    const leaveRequestId = validateIntParam(c.req.param("id"), "leave request")

    const body = c.req.valid("json")

    const updated = await new DecideLeaveRequest(c).run({
      leaveRequestId,
      approverId: session.employeeId,
      action: "reject",
      comment: body.comment,
    })

    if (updated instanceof Error) {
      throw new InternalError("failed to reject leave request")
    }

    if ("failure" in updated) {
      if (updated.failure === "self_approval") {
        throw new ForbiddenError()
      }

      if (updated.failure === "already_decided") {
        throw new ConflictError("leave request already decided")
      }

      if (updated.failure === "invalid_start_date") {
        throw new InternalError("invalid leave request start date")
      }

      throw new NotFoundError("leave request not found")
    }

    const responseBody = {
      id: updated.id,
      employee_id: updated.employeeId,
      leave_type: updated.leaveType,
      start_date: updated.startDate,
      end_date: updated.endDate,
      days: updated.days,
      reason: updated.reason,
      status: updated.status,
      approver_id: updated.approverId,
      decided_comment: updated.decidedComment,
      created_at: updated.createdAt,
    }

    return c.json(responseBody, 200)
  },
)

import { DecideLeaveRequest } from "@/application/leave/decide-leave-request"
import { LeaveRequest } from "@/domain/leave/leave-request.entity"
import { canDecideLeave } from "@/lib/leave/can-decide-leave"
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

// POST /leave/requests/:id/approve — 休暇申請を承認する
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
      viewerRole: session.role,
      leaveRequestId,
      approverId: session.employeeId,
      action: "approve",
      comment: body.comment,
    })

    if (updated instanceof Error) {
      throw new InternalError("failed to approve leave request")
    }

    if (updated instanceof LeaveRequest) {
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
    }

    if (updated.reason === "forbidden") {
      throw new ForbiddenError()
    }

    if (updated.reason === "self_approval") {
      throw new ForbiddenError()
    }

    if (updated.reason === "already_decided") {
      throw new ConflictError("leave request already decided")
    }

    if (updated.reason === "balance_not_found") {
      throw new ConflictError("leave balance record not found")
    }

    if (updated.reason === "insufficient_balance") {
      throw new ConflictError("insufficient leave balance")
    }

    if (updated.reason === "invalid_start_date") {
      throw new InternalError("invalid leave request start date")
    }

    throw new NotFoundError("leave request not found")
  },
)

import { DecideLeaveRequest } from "@/application/leave/decide-leave-request"
import { ApplicationError } from "@/lib/errors"
import { canDecideLeave } from "@/lib/leave/can-decide-leave"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppLeaveRequest } from "@/lib/app-schemas"
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

    if (canDecideLeave(session) === false) {
      throw new ForbiddenError()
    }

    const leaveRequestId = validateIntParam(c.req.param("id"), "leave request")

    const body = c.req.valid("json")

    const updated = await new DecideLeaveRequest(c).run({
      session: session,
      leaveRequestId,
      approverId: session.employeeId,
      action: "approve",
      comment: body.comment,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppLeaveRequest.parse({
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
    })

    return c.json(responseBody, 200)
  },
)

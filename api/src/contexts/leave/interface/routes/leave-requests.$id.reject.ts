import { DecideLeaveRequest } from "@/contexts/leave/application/decide-leave-request"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppLeaveRequest } from "@/lib/app-schemas"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/** POST /leave-requests/:id/reject — 休暇申請を却下する（コメント必須） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      comment: z.string().min(1).max(3_000),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("leave:approve") === false) {
      throw new ForbiddenError()
    }

    const leaveRequestId = validateIntParam(c.req.param("id"), "leave request")

    const body = c.req.valid("json")

    const updated = await new DecideLeaveRequest(c).run({
      session: session,
      leaveRequestId,
      approverId: session.employeeId,
      action: "reject",
      comment: body.comment,
      createdAt: c.env.NOW ?? new Date().toISOString(),
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
      unit: updated.unit,
      hours: updated.hours,
      reason: updated.reason,
      status: updated.status,
      approver_id: updated.approverId,
      decided_comment: updated.decidedComment,
      created_at: updated.createdAt,
    })

    return c.json(responseBody, 200)
  },
)

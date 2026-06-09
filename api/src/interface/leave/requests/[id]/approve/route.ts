import { DecideLeaveRequest } from "@/application/leave/decide-leave-request"
import { canDecideLeave } from "@/domain/leave/can-decide-leave"
import { toFiscalYear } from "@/domain/leave/to-fiscal-year"
import { toLeaveRequestId } from "@/domain/leave/to-leave-request-id"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
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

    const leaveRequestId = toLeaveRequestId(c.req.param("id") ?? "")

    if (leaveRequestId === null) {
      throw new BadRequestError("invalid leave request id")
    }

    const body = c.req.valid("json")

    const updated = await new DecideLeaveRequest(c).run({
      leaveRequestId,
      approverId: session.employeeId,
      action: "approve",
      comment: body.comment,
      fiscalYear: toFiscalYear(c.env.NOW ?? new Date().toISOString()),
    })

    if (updated instanceof Error) {
      throw new InternalError("failed to approve leave request")
    }

    if ("failure" in updated) {
      if (updated.failure === "already_decided") {
        throw new ConflictError("leave request already decided")
      }

      if (updated.failure === "leave_balance_not_found") {
        throw new ConflictError("leave balance record not found for the employee")
      }

      throw new NotFoundError("leave request not found")
    }

    return c.json({ status: updated.status }, 200)
  },
)

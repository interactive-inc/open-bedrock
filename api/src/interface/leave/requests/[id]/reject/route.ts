import { DecideLeaveRequest } from "@/application/leave/decide-leave-request"
import { canDecideLeave } from "@/domain/leave/can-decide-leave"
import { toFiscalYear } from "@/domain/leave/to-fiscal-year"
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

    const fiscalYear = toFiscalYear(c.env.NOW ?? new Date().toISOString())

    if (fiscalYear === null) {
      throw new InternalError("invalid server time")
    }

    const updated = await new DecideLeaveRequest(c).run({
      leaveRequestId,
      approverId: session.employeeId,
      action: "reject",
      comment: body.comment,
      fiscalYear,
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

      throw new NotFoundError("leave request not found")
    }

    return c.json({ status: updated.status }, 200)
  },
)

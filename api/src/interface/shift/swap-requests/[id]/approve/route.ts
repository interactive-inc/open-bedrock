import { ApproveShiftSwapRequest } from "@/application/shift/approve-shift-swap-request"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/shared/validate-int-param"

// POST /shift/swap-requests/:id/approve — 特権ロールが保留中の交代申請を承認する
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const swapRequestId = validateIntParam(c.req.param("id"), "swap request")

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const swapRequest = await new ApproveShiftSwapRequest(c).run({
    viewerRole: session.role,
    swapRequestId,
    approvedAt: c.env.NOW ?? new Date().toISOString(),
  })

  if (swapRequest instanceof Error) {
    throw new InternalError("failed to approve swap request")
  }

  if ("reason" in swapRequest) {
    if (swapRequest.reason === "forbidden") {
      throw new ForbiddenError()
    }

    if (swapRequest.reason === "already_approved") {
      throw new ConflictError("already approved")
    }

    throw new NotFoundError("swap request not found")
  }

  const responseBody = {
    id: swapRequest.id,
    requester_employee_id: swapRequest.requesterEmployeeId,
    target_employee_id: swapRequest.targetEmployeeId,
    date: swapRequest.date,
    note: swapRequest.note,
    status: swapRequest.status,
    approved_at: swapRequest.approvedAt,
  }

  return c.json(responseBody, 200)
})

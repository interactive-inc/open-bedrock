import { ApproveShiftSwapRequest } from "@/application/shift/approve-shift-swap-request"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppShiftSwapRequest } from "@/lib/app-schemas"
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
    approverId: session.employeeId,
    swapRequestId,
    approvedAt: c.env.NOW ?? new Date().toISOString(),
  })

  if (swapRequest instanceof ApplicationError) {
    throw toHttpException(swapRequest)
  }

  const responseBody = zAppShiftSwapRequest.parse({
    id: swapRequest.id,
    requester_employee_id: swapRequest.requesterEmployeeId,
    target_employee_id: swapRequest.targetEmployeeId,
    date: swapRequest.date,
    note: swapRequest.note,
    status: swapRequest.status,
    approved_at: swapRequest.approvedAt,
  })

  return c.json(responseBody, 200)
})

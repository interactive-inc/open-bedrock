import { ApproveShiftSwapRequest } from "@/contexts/company/application/shift/approve-shift-swap-request"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppShiftSwapRequest } from "@/lib/app-schemas"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"

// @authorization service - session を application service に渡して判定する
/** POST /shift-swap-requests/:id/approve — 特権ロールが保留中の交代申請を承認する */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const swapRequestId = validateIntParam(c.req.param("id"), "swap request")

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const swapRequest = await new ApproveShiftSwapRequest(c).run({
    session: session,
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

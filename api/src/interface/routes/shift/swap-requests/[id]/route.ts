import { CancelShiftSwapRequest } from "@/application/shift/cancel-shift-swap-request"
import { GetShiftSwapRequest } from "@/application/shift/get-shift-swap-request"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppShiftSwapRequest } from "@/lib/app-schemas"
import type { ShiftSwapRequest } from "@/domain/shift/shift-swap-request.entity"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/utils/validate-int-param"

/** 交代申請をレスポンス用の snake_case に整形する。 */
function toResponseBody(swapRequest: ShiftSwapRequest) {
  return zAppShiftSwapRequest.parse({
    id: swapRequest.id,
    requester_employee_id: swapRequest.requesterEmployeeId,
    target_employee_id: swapRequest.targetEmployeeId,
    date: swapRequest.date,
    note: swapRequest.note,
    status: swapRequest.status,
    approved_at: swapRequest.approvedAt,
  })
}

/** GET /shift/swap-requests/:id — 交代申請の詳細（申請者本人か承認権限者） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const swapRequestId = validateIntParam(c.req.param("id"), "swap request")

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const swapRequest = await new GetShiftSwapRequest(c).run({
    viewerEmployeeId: session.employeeId,
    session: session,
    swapRequestId,
  })

  if (swapRequest instanceof ApplicationError) {
    throw toHttpException(swapRequest)
  }

  return c.json(toResponseBody(swapRequest), 200)
})

/** DELETE /shift/swap-requests/:id — 保留中の交代申請を取り下げる（申請者本人） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const swapRequestId = validateIntParam(c.req.param("id"), "swap request")

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new CancelShiftSwapRequest(c).run({
    requesterEmployeeId: session.employeeId,
    swapRequestId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})

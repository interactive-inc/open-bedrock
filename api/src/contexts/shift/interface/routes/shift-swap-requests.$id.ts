import { CancelShiftSwapRequest } from "@/contexts/shift/application/cancel-shift-swap-request"
import { GetShiftSwapRequest } from "@/contexts/shift/application/get-shift-swap-request"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { zAppShiftSwapRequest } from "@/lib/app-schemas"
import type { ShiftSwapRequest } from "@/contexts/shift/domain/shift-swap-request.entity"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { validateIntParam } from "@/contexts/company-compatibility/interface/utils/validate-int-param"

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

// @authorization service - session を application service に渡して判定する
/** GET /shift-swap-requests/:id — 交代申請の詳細（申請者本人か承認権限者） */
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

// @authorization owner - 本人のリソースに限定する
/** DELETE /shift-swap-requests/:id — 保留中の交代申請を取り下げる（申請者本人） */
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

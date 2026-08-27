import { ApproveShiftSwapRequest } from "@/contexts/shift/application/approve-shift-swap-request"
import { EmployeeNotificationAdapter } from "@/api/http/notifications/employee-notification.adapter"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppShiftSwapRequest } from "@/lib/app-schemas"
import { validateIntParam } from "@/lib/http/validate-int-param"

// @authorization service - session を application service に渡して判定する
/** POST /shift-swap-requests/:id/approve — 特権ロールが保留中の交代申請を承認する */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const swapRequestId = validateIntParam(c.req.param("id"), "swap request")

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const swapRequest = await new ApproveShiftSwapRequest({
    context: c,
    publishEmployeeNotification: (notification) =>
      new EmployeeNotificationAdapter(c).create(notification),
  }).run({
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

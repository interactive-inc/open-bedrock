import { ConflictError } from "@/lib/errors"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { ShiftSwapRequestRepository } from "@/contexts/shift/infrastructure/repositories/shift-swap-request.repository"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppShiftSwapRequest } from "@/contexts/shift/interface/http/response-schemas"
import type { ShiftSwapRequest } from "@/contexts/shift/domain/entities/shift-swap-request.entity"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { validateIntParam } from "@/lib/http/validate-int-param"

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

  const swapRequest = await (async () => {
    const input = {
      viewerEmployeeId: session.employeeId,
      session: session,
      swapRequestId,
    }

    const swapRequestRepository = new ShiftSwapRequestRepository(c)

    const swapRequest = await swapRequestRepository.findById(input.swapRequestId)

    if (swapRequest instanceof Error) {
      return new UnexpectedError("failed to find shift swap request", { cause: swapRequest })
    }

    if (swapRequest === null) {
      return new NotFoundError("shift swap request not found", "swap_request_not_found")
    }

    const isRequester = swapRequest.requesterEmployeeId === input.viewerEmployeeId

    const isTargetEmployee = swapRequest.targetEmployeeId === input.viewerEmployeeId

    if (
      isRequester === false &&
      isTargetEmployee === false &&
      input.session.hasPermission("shift_swap:approve") === false &&
      input.session.hasPermission("shift_swap:read:all") === false
    ) {
      return new ForbiddenError("cannot view this shift swap request", "not_visible")
    }

    return swapRequest
  })()

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

  const result = await (async () => {
    const input = {
      requesterEmployeeId: session.employeeId,
      swapRequestId,
    }

    const swapRequestRepository = new ShiftSwapRequestRepository(c)

    const current = await swapRequestRepository.findById(input.swapRequestId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find shift swap request", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("shift swap request not found", "swap_request_not_found")
    }

    if (current.requesterEmployeeId !== input.requesterEmployeeId) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    if (current.status === "approved") {
      return new ConflictError(
        "approved shift swap request cannot be cancelled",
        "already_approved",
      )
    }

    const deleted = await swapRequestRepository.delete(input.swapRequestId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete shift swap request", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError(
        "approved shift swap request cannot be cancelled",
        "already_approved",
      )
    }

    return { reason: "cancelled" }
  })()

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})

import { CancelShiftSwapRequest } from "@/application/shift/cancel-shift-swap-request"
import { GetShiftSwapRequest } from "@/application/shift/get-shift-swap-request"
import type { ShiftSwapRequest } from "@/domain/shift/shift-swap-request"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"

// 交代申請をレスポンス用の snake_case に整形する。
function toResponseBody(swapRequest: ShiftSwapRequest) {
  return {
    id: swapRequest.id,
    requester_employee_id: swapRequest.requesterEmployeeId,
    target_employee_id: swapRequest.targetEmployeeId,
    date: swapRequest.date,
    note: swapRequest.note,
    status: swapRequest.status,
    approved_at: swapRequest.approvedAt,
  }
}

// GET /shift/swap-requests/:id — 交代申請の詳細（申請者本人か承認権限者）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const swapRequestId = Number(c.req.param("id") ?? "")

  if (Number.isInteger(swapRequestId) === false) {
    throw new BadRequestError("invalid swap request id")
  }

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const swapRequest = await new GetShiftSwapRequest(c).run({
    viewerEmployeeId: session.employeeId,
    viewerRole: session.role,
    swapRequestId,
  })

  if (swapRequest instanceof Error) {
    throw new InternalError("failed to load swap request")
  }

  if ("reason" in swapRequest) {
    if (swapRequest.reason === "not_visible") {
      throw new ForbiddenError("not allowed to view this swap request")
    }

    throw new NotFoundError("swap request not found")
  }

  return c.json(toResponseBody(swapRequest), 200)
})

// DELETE /shift/swap-requests/:id — 保留中の交代申請を取り下げる（申請者本人）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const swapRequestId = Number(c.req.param("id") ?? "")

  if (Number.isInteger(swapRequestId) === false) {
    throw new BadRequestError("invalid swap request id")
  }

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new CancelShiftSwapRequest(c).run({
    requesterEmployeeId: session.employeeId,
    swapRequestId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to cancel swap request")
  }

  if (result.reason === "not_requester") {
    throw new ForbiddenError("not the requester")
  }

  if (result.reason === "already_approved") {
    throw new ConflictError("approved swap request cannot be cancelled")
  }

  if (result.reason === "swap_request_not_found") {
    throw new NotFoundError("swap request not found")
  }

  return c.body(null, 204)
})

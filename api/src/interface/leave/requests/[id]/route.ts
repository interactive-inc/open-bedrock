import { CancelLeaveRequest } from "@/application/leave/cancel-leave-request"
import { GetLeaveRequest } from "@/application/leave/get-leave-request"
import { UpdateLeaveRequest } from "@/application/leave/update-leave-request"
import { LeaveRequest } from "@/domain/leave/leave-request"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 休暇申請をレスポンス用に整形する。
function toResponseBody(leaveRequest: LeaveRequest) {
  return {
    id: leaveRequest.id,
    employee_id: leaveRequest.employeeId,
    leave_type: leaveRequest.leaveType,
    start_date: leaveRequest.startDate,
    end_date: leaveRequest.endDate,
    days: leaveRequest.days,
    reason: leaveRequest.reason,
    status: leaveRequest.status,
    created_at: leaveRequest.createdAt,
  }
}

// path の :id を数値へ。不正値は null。
function toLeaveRequestId(value: string): number | null {
  const parsed = Number(value)

  if (Number.isInteger(parsed) === false) {
    return null
  }

  return parsed
}

// GET /leave/requests/:id — 休暇申請の詳細（申請者本人のみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const leaveRequestId = toLeaveRequestId(c.req.param("id") ?? "")

  if (leaveRequestId === null) {
    throw new NotFoundError("leave request not found")
  }

  const result = await new GetLeaveRequest(c).run({
    leaveRequestId,
    employeeId: viewer.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to load leave request")
  }

  if (result instanceof LeaveRequest) {
    return c.json(toResponseBody(result), 200)
  }

  if (result.reason === "leave_request_not_found") {
    throw new NotFoundError("leave request not found")
  }

  throw new ForbiddenError("not the applicant")
})

// PUT /leave/requests/:id — 休暇申請の内容を変更（申請者本人・pending のみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      leave_type: z.enum(["annual", "special"]),
      start_date: isoDate,
      end_date: isoDate,
      reason: z.string().nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const leaveRequestId = toLeaveRequestId(c.req.param("id") ?? "")

    if (leaveRequestId === null) {
      throw new NotFoundError("leave request not found")
    }

    const json = c.req.valid("json")

    const result = await new UpdateLeaveRequest(c).run({
      leaveRequestId,
      employeeId: viewer.employeeId,
      leaveType: json.leave_type,
      startDate: json.start_date,
      endDate: json.end_date,
      reason: json.reason ?? null,
    })

    if (result instanceof Error) {
      throw new InternalError("failed to update leave request")
    }

    if (result instanceof LeaveRequest) {
      return c.json(toResponseBody(result), 200)
    }

    if (result.reason === "leave_request_not_found") {
      throw new NotFoundError("leave request not found")
    }

    if (result.reason === "not_applicant") {
      throw new ForbiddenError("not the applicant")
    }

    if (result.reason === "invalid_leave_period") {
      throw new BadRequestError("invalid leave period")
    }

    throw new ConflictError("the leave request is already decided")
  },
)

// DELETE /leave/requests/:id — 休暇申請を取り下げ（申請者本人・pending のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const leaveRequestId = toLeaveRequestId(c.req.param("id") ?? "")

  if (leaveRequestId === null) {
    throw new NotFoundError("leave request not found")
  }

  const result = await new CancelLeaveRequest(c).run({
    leaveRequestId,
    employeeId: viewer.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to cancel leave request")
  }

  if (result.reason === "leave_request_not_found") {
    throw new NotFoundError("leave request not found")
  }

  if (result.reason === "not_applicant") {
    throw new ForbiddenError("not the applicant")
  }

  if (result.reason === "not_modifiable") {
    throw new ConflictError("the leave request is already decided")
  }

  return c.body(null, 204)
})

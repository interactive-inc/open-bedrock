import { CancelLeaveRequest } from "@/contexts/company/application/leave/cancel-leave-request"
import { GetLeaveRequest } from "@/contexts/company/application/leave/get-leave-request"
import { UpdateLeaveRequest } from "@/contexts/company/application/leave/update-leave-request"
import { LeaveRequest } from "@/contexts/company/domain/leave/leave-request.entity"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { NotFoundError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppLeaveRequestDetail } from "@/lib/app-schemas"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import { isoDate, leaveTypeSchema, leaveUnitSchema } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 休暇申請を詳細レスポンス用に整形する。 */
function toResponseBody(leaveRequest: LeaveRequest) {
  return zAppLeaveRequestDetail.parse({
    id: leaveRequest.id,
    employee_id: leaveRequest.employeeId,
    leave_type: leaveRequest.leaveType,
    start_date: leaveRequest.startDate,
    end_date: leaveRequest.endDate,
    days: leaveRequest.days,
    unit: leaveRequest.unit,
    hours: leaveRequest.hours,
    reason: leaveRequest.reason,
    status: leaveRequest.status,
    created_at: leaveRequest.createdAt,
  })
}

/** path の :id を数値へ。不正値は null。 */
function toLeaveRequestId(value: string): number | null {
  const parsed = Number(value)

  if (Number.isInteger(parsed) === false) {
    return null
  }

  return parsed
}

// @authorization service - session を application service に渡して判定する
/** GET /leave-requests/:id — 休暇申請の詳細（申請者本人または承認権限者） */
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
    session: viewer,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.json(toResponseBody(result), 200)
})

// @authorization owner - 本人のリソースに限定する
/** PUT /leave-requests/:id — 休暇申請の内容を変更（申請者本人・pending のみ） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        leave_type: leaveTypeSchema,
        start_date: isoDate,
        end_date: isoDate,
        unit: leaveUnitSchema.optional(),
        hours: z.number().positive().nullable().optional(),
        reason: z.string().max(3_000).nullable().optional(),
      })
      .refine((d) => d.start_date <= d.end_date, {
        message: "end_date must be on or after start_date",
        path: ["end_date"],
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
      unit: json.unit ?? "full_day",
      hours: json.hours ?? null,
      reason: json.reason ?? null,
    })

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    return c.json(toResponseBody(result), 200)
  },
)

// @authorization owner - 本人のリソースに限定する
/** DELETE /leave-requests/:id — 休暇申請を取り下げ（申請者本人・pending のみ） */
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

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})

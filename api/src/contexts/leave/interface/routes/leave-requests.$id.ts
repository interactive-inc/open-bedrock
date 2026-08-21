import { ConflictError } from "@/lib/errors"
import { resolveOrganizationAuthority } from "@/contexts/company/infrastructure/organization/resolve-organization-authority.repository"
import {
  ForbiddenError,
  NotFoundError as ApplicationNotFoundError,
  UnexpectedError,
} from "@/lib/errors"
import { LeaveRequestRepository } from "@/contexts/leave/infrastructure/leave-request.repository"
import { UpdateLeaveRequest } from "@/contexts/leave/application/update-leave-request"
import { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { zAppLeaveRequestDetail } from "@/lib/app-schemas"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
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

  const result = await (async () => {
    const command = {
      leaveRequestId,
      employeeId: viewer.employeeId,
      session: viewer,
    }

    const repository = new LeaveRequestRepository(c)

    const leaveRequest = await repository.findById(command.leaveRequestId)

    if (leaveRequest instanceof Error) {
      return new UnexpectedError("failed to find leave request", { cause: leaveRequest })
    }

    if (leaveRequest === null) {
      return new ApplicationNotFoundError("leave request not found", "leave_request_not_found")
    }

    const isApplicant = leaveRequest.employeeId === command.employeeId
    if (isApplicant === false) {
      const canViewAll =
        command.session !== undefined && command.session.hasPermission("leave:read:all")

      if (canViewAll) {
        return leaveRequest
      }

      const canDecide =
        command.session !== undefined && command.session.hasPermission("leave:approve")

      if (canDecide === false || command.session === undefined) {
        return new ForbiddenError("not the applicant", "not_applicant")
      }

      if (command.session.hasPermission("org:manage") === false) {
        const organizationAuthority = await resolveOrganizationAuthority(
          c,
          command.employeeId,
          leaveRequest.employeeId,
        )

        if (organizationAuthority instanceof Error) {
          return new UnexpectedError("failed to resolve organization authority", {
            cause: organizationAuthority,
          })
        }

        if (
          organizationAuthority.managementChain === false &&
          organizationAuthority.departmentManager === false
        ) {
          return new ForbiddenError(
            "cannot view leave request outside organization scope",
            "forbidden",
          )
        }
      }
    }

    return leaveRequest
  })()

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

  const result = await (async () => {
    const command = {
      leaveRequestId,
      employeeId: viewer.employeeId,
    }

    const repository = new LeaveRequestRepository(c)

    const current = await repository.findById(command.leaveRequestId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find leave request", { cause: current })
    }

    if (current === null) {
      return new ApplicationNotFoundError("leave request not found", "leave_request_not_found")
    }

    if (current.employeeId !== command.employeeId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    if (current.isModifiable === false) {
      return new ConflictError("the leave request is already decided", "not_modifiable")
    }

    const deleted = await repository.delete(command.leaveRequestId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete leave request", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("the leave request is already decided", "not_modifiable")
    }

    return { reason: "cancelled" }
  })()

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})

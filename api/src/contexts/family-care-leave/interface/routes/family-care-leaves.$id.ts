import { ConflictError } from "@/lib/errors"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { FamilyCareLeaveRepository } from "@/contexts/family-care-leave/infrastructure/family-care-leave.repository"
import { UpdateFamilyCareLeave } from "@/contexts/family-care-leave/application/update-family-care-leave"
import type { FamilyCareLeave } from "@/contexts/family-care-leave/domain/entities/family-care-leave.entity"
import { factory } from "@/api/http/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppFamilyCareLeave } from "@/lib/app-schemas"
import { validateUuidParam } from "@/lib/http/validate-uuid-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 休業申出をレスポンス用の snake_case に整形し、スキーマで検証する。 */
function toResponseBody(familyCareLeave: FamilyCareLeave) {
  return zAppFamilyCareLeave.parse({
    id: familyCareLeave.id,
    employee_id: familyCareLeave.employeeId,
    leave_kind: familyCareLeave.leaveKind,
    start_date: familyCareLeave.startDate,
    end_date: familyCareLeave.endDate,
    note: familyCareLeave.note,
    status: familyCareLeave.status,
    created_at: familyCareLeave.createdAt,
  })
}

// @authorization owner - 本人のリソースに限定する
/** GET /family-care-leaves/:id — 休業申出の詳細（本人のみ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const familyCareLeave = await (async () => {
    const command = {
      familyCareLeaveId: validateUuidParam(c.req.param("id"), "family care leave"),
      employeeId: viewer.employeeId,
    }

    const familyCareLeaveRepository = new FamilyCareLeaveRepository(c)

    const familyCareLeave = await familyCareLeaveRepository.findById(command.familyCareLeaveId)

    if (familyCareLeave instanceof Error) {
      return new UnexpectedError("failed to find family care leave", { cause: familyCareLeave })
    }

    if (familyCareLeave === null) {
      return new NotFoundError("family care leave not found", "family_care_leave_not_found")
    }

    if (familyCareLeave.employeeId !== command.employeeId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    return familyCareLeave
  })()

  if (familyCareLeave instanceof ApplicationError) {
    throw toHttpException(familyCareLeave)
  }

  return c.json(toResponseBody(familyCareLeave), 200)
})

// @authorization owner - 本人のリソースに限定する
/** PUT /family-care-leaves/:id — 休業申出の内容を変更（本人のみ） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        leave_kind: z.string().min(1).max(200),
        start_date: isoDate,
        end_date: isoDate,
        note: z.string().max(3_000).nullable().optional(),
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

    const json = c.req.valid("json")

    const familyCareLeave = await new UpdateFamilyCareLeave(c).run({
      familyCareLeaveId: validateUuidParam(c.req.param("id"), "family care leave"),
      employeeId: viewer.employeeId,
      leaveKind: json.leave_kind,
      startDate: json.start_date,
      endDate: json.end_date,
      note: json.note ?? null,
    })

    if (familyCareLeave instanceof ApplicationError) {
      throw toHttpException(familyCareLeave)
    }

    return c.json(toResponseBody(familyCareLeave), 200)
  },
)

// @authorization owner - 本人のリソースに限定する
/** DELETE /family-care-leaves/:id — 休業申出を取消（本人のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await (async () => {
    const command = {
      familyCareLeaveId: validateUuidParam(c.req.param("id"), "family care leave"),
      employeeId: viewer.employeeId,
    }

    const familyCareLeaveRepository = new FamilyCareLeaveRepository(c)

    const current = await familyCareLeaveRepository.findById(command.familyCareLeaveId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find family care leave", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("family care leave not found", "family_care_leave_not_found")
    }

    if (current.employeeId !== command.employeeId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    if (current.status !== "requested") {
      return new ConflictError("family care leave not modifiable", "not_modifiable")
    }

    const deleted = await familyCareLeaveRepository.delete(command.familyCareLeaveId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete family care leave", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("family care leave not modifiable", "not_modifiable")
    }

    return { reason: "cancelled" }
  })()

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})

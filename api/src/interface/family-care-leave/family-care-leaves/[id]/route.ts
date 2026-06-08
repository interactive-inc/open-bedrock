import { CancelFamilyCareLeave } from "@/application/family-care-leave/cancel-family-care-leave"
import { GetFamilyCareLeave } from "@/application/family-care-leave/get-family-care-leave"
import { UpdateFamilyCareLeave } from "@/application/family-care-leave/update-family-care-leave"
import type { FamilyCareLeave } from "@/domain/family-care-leave/family-care-leave"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 休業申出をレスポンス用の snake_case に整形する。
function toResponseBody(familyCareLeave: FamilyCareLeave) {
  return {
    id: familyCareLeave.id,
    employee_id: familyCareLeave.employeeId,
    leave_kind: familyCareLeave.leaveKind,
    start_date: familyCareLeave.startDate,
    end_date: familyCareLeave.endDate,
    note: familyCareLeave.note,
    status: familyCareLeave.status,
    created_at: familyCareLeave.createdAt,
  }
}

// GET /family-care-leaves/:id — 休業申出の詳細（本人のみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const familyCareLeave = await new GetFamilyCareLeave(c).run({
    familyCareLeaveId: c.req.param("id") ?? "",
    employeeId: viewer.employeeId,
  })

  if (familyCareLeave instanceof Error) {
    throw new InternalError("failed to load family care leave")
  }

  if ("reason" in familyCareLeave) {
    if (familyCareLeave.reason === "family_care_leave_not_found") {
      throw new NotFoundError("family care leave not found")
    }

    throw new ForbiddenError("not the applicant")
  }

  return c.json(toResponseBody(familyCareLeave), 200)
})

// PUT /family-care-leaves/:id — 休業申出の内容を変更（本人のみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      leave_kind: z.string().min(1),
      start_date: isoDate,
      end_date: isoDate,
      note: z.string().nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const familyCareLeave = await new UpdateFamilyCareLeave(c).run({
      familyCareLeaveId: c.req.param("id") ?? "",
      employeeId: viewer.employeeId,
      leaveKind: json.leave_kind,
      startDate: json.start_date,
      endDate: json.end_date,
      note: json.note ?? null,
    })

    if (familyCareLeave instanceof Error) {
      throw new InternalError("failed to update family care leave")
    }

    if ("reason" in familyCareLeave) {
      if (familyCareLeave.reason === "family_care_leave_not_found") {
        throw new NotFoundError("family care leave not found")
      }

      throw new ForbiddenError("not the applicant")
    }

    return c.json(toResponseBody(familyCareLeave), 200)
  },
)

// DELETE /family-care-leaves/:id — 休業申出を取消（本人のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await new CancelFamilyCareLeave(c).run({
    familyCareLeaveId: c.req.param("id") ?? "",
    employeeId: viewer.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to cancel family care leave")
  }

  if (result.reason === "family_care_leave_not_found") {
    throw new NotFoundError("family care leave not found")
  }

  if (result.reason === "not_applicant") {
    throw new ForbiddenError("not the applicant")
  }

  return c.body(null, 204)
})

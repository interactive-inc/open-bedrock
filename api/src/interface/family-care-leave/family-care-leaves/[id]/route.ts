import { CancelFamilyCareLeave } from "@/application/family-care-leave/cancel-family-care-leave"
import { GetFamilyCareLeave } from "@/application/family-care-leave/get-family-care-leave"
import { UpdateFamilyCareLeave } from "@/application/family-care-leave/update-family-care-leave"
import type { FamilyCareLeave } from "@/domain/family-care-leave/family-care-leave"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { toResourceId } from "@/interface/shared/to-resource-id"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

function toResponseBody(r: FamilyCareLeave) {
  return {
    id: r.id,
    employee_id: r.employeeId,
    leave_kind: r.leaveKind,
    start_date: r.startDate,
    end_date: r.endDate,
    note: r.note,
    status: r.status,
    created_at: r.createdAt,
  }
}

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session
  if (viewer === null) {
    throw new UnauthorizedError()
  }
  const id = toResourceId(c.req.param("id") ?? "")
  if (id === null) {
    throw new BadRequestError("invalid family care leave id")
  }
  const r = await new GetFamilyCareLeave(c).run({
    familyCareLeaveId: id,
    employeeId: viewer.employeeId,
  })
  if (r instanceof Error) {
    throw new InternalError("failed to load family care leave")
  }
  if ("reason" in r) {
    if (r.reason === "family_care_leave_not_found") {
      throw new NotFoundError("family care leave not found")
    }
    throw new ForbiddenError("not the applicant")
  }
  return c.json(toResponseBody(r), 200)
})
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
    const id = toResourceId(c.req.param("id") ?? "")
    if (id === null) {
      throw new BadRequestError("invalid family care leave id")
    }
    const json = c.req.valid("json")
    const r = await new UpdateFamilyCareLeave(c).run({
      familyCareLeaveId: id,
      employeeId: viewer.employeeId,
      leaveKind: json.leave_kind,
      startDate: json.start_date,
      endDate: json.end_date,
      note: json.note ?? null,
    })
    if (r instanceof Error) {
      throw new InternalError("failed to update family care leave")
    }
    if ("reason" in r) {
      if (r.reason === "family_care_leave_not_found") {
        throw new NotFoundError("family care leave not found")
      }
      if (r.reason === "not_modifiable") {
        throw new ConflictError("not modifiable")
      }
      throw new ForbiddenError("not the applicant")
    }
    return c.json(toResponseBody(r), 200)
  },
)
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session
  if (viewer === null) {
    throw new UnauthorizedError()
  }
  const id = toResourceId(c.req.param("id") ?? "")
  if (id === null) {
    throw new BadRequestError("invalid family care leave id")
  }
  const r = await new CancelFamilyCareLeave(c).run({
    familyCareLeaveId: id,
    employeeId: viewer.employeeId,
  })
  if (r instanceof Error) {
    throw new InternalError("failed to cancel family care leave")
  }
  if (r.reason === "family_care_leave_not_found") {
    throw new NotFoundError("family care leave not found")
  }
  if (r.reason === "not_applicant") {
    throw new ForbiddenError("not the applicant")
  }
  if (r.reason === "not_modifiable") {
    throw new ConflictError("not modifiable")
  }
  return c.body(null, 204)
})

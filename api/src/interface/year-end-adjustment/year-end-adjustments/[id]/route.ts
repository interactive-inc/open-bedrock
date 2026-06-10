import { CancelYearEndAdjustment } from "@/application/year-end-adjustment/cancel-year-end-adjustment"
import { GetYearEndAdjustment } from "@/application/year-end-adjustment/get-year-end-adjustment"
import { UpdateYearEndAdjustment } from "@/application/year-end-adjustment/update-year-end-adjustment"
import type { YearEndAdjustment } from "@/domain/year-end-adjustment/year-end-adjustment"
import { factory } from "@/lib/factory"
import { toResourceId } from "@/interface/shared/to-resource-id"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 年末調整申告をレスポンス用の snake_case に整形する。
function toResponseBody(yearEndAdjustment: YearEndAdjustment) {
  return {
    id: yearEndAdjustment.id,
    employee_id: yearEndAdjustment.employeeId,
    target_year: yearEndAdjustment.targetYear,
    note: yearEndAdjustment.note,
    status: yearEndAdjustment.status,
    created_at: yearEndAdjustment.createdAt,
  }
}

// GET /year-end-adjustments/:id — 年末調整申告の詳細（本人のみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const id = toResourceId(c.req.param("id") ?? "")

  if (id === null) {
    throw new BadRequestError("invalid id")
  }

  const yearEndAdjustment = await new GetYearEndAdjustment(c).run({
    yearEndAdjustmentId: id,
    employeeId: viewer.employeeId,
  })

  if (yearEndAdjustment instanceof Error) {
    throw new InternalError("failed to load year end adjustment")
  }

  if ("reason" in yearEndAdjustment) {
    if (yearEndAdjustment.reason === "year_end_adjustment_not_found") {
      throw new NotFoundError("year end adjustment not found")
    }

    throw new ForbiddenError("not the applicant")
  }

  return c.json(toResponseBody(yearEndAdjustment), 200)
})

// PUT /year-end-adjustments/:id — 年末調整申告の内容を変更（本人のみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      target_year: z.number().int().min(2000).max(2100),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const id = toResourceId(c.req.param("id") ?? "")

    if (id === null) {
      throw new BadRequestError("invalid id")
    }

    const yearEndAdjustment = await new UpdateYearEndAdjustment(c).run({
      yearEndAdjustmentId: id,
      employeeId: viewer.employeeId,
      targetYear: json.target_year,
      note: json.note ?? null,
    })

    if (yearEndAdjustment instanceof Error) {
      throw new InternalError("failed to update year end adjustment")
    }

    if ("reason" in yearEndAdjustment) {
      if (yearEndAdjustment.reason === "year_end_adjustment_not_found") {
        throw new NotFoundError("year end adjustment not found")
      }

      if (yearEndAdjustment.reason === "not_modifiable") {
        throw new ConflictError("not modifiable")
      }

      throw new ForbiddenError("not the applicant")
    }

    return c.json(toResponseBody(yearEndAdjustment), 200)
  },
)

// DELETE /year-end-adjustments/:id — 年末調整申告を取消（本人のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const id = toResourceId(c.req.param("id") ?? "")

  if (id === null) {
    throw new BadRequestError("invalid id")
  }

  const result = await new CancelYearEndAdjustment(c).run({
    yearEndAdjustmentId: id,
    employeeId: viewer.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to cancel year end adjustment")
  }

  if (result.reason === "year_end_adjustment_not_found") {
    throw new NotFoundError("year end adjustment not found")
  }

  if (result.reason === "not_applicant") {
    throw new ForbiddenError("not the applicant")
  }

  if (result.reason === "not_modifiable") {
    throw new ConflictError("not modifiable")
  }

  return c.body(null, 204)
})

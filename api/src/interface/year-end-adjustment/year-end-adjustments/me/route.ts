import { ListMyYearEndAdjustments } from "@/application/year-end-adjustment/list-my-year-end-adjustments"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

// GET /year-end-adjustments/me — 本人の年末調整申告一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const yearEndAdjustments = await new ListMyYearEndAdjustments(c).run({
    employeeId: viewer.employeeId,
  })

  if (yearEndAdjustments instanceof Error) {
    throw new InternalError("failed to load year end adjustments")
  }

  const responseBody = yearEndAdjustments.map((yearEndAdjustment) => ({
    id: yearEndAdjustment.id,
    employee_id: yearEndAdjustment.employeeId,
    target_year: yearEndAdjustment.targetYear,
    note: yearEndAdjustment.note,
    status: yearEndAdjustment.status,
    created_at: yearEndAdjustment.createdAt,
  }))

  return c.json(responseBody, 200)
})

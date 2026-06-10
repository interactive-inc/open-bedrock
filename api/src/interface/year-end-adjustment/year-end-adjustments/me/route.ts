import { ListMyYearEndAdjustments } from "@/application/year-end-adjustment/list-my-year-end-adjustments"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

// GET /year-end-adjustments/me — 本人の年末調整申告一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const yearEndAdjustments = await new ListMyYearEndAdjustments(c).run({
    employeeId: viewer.employeeId,
    limit,
    offset,
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

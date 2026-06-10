import { ListMyFamilyCareLeaves } from "@/application/family-care-leave/list-my-family-care-leaves"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

// GET /family-care-leaves/me — 申出者本人の休業申出一覧
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

  const familyCareLeaves = await new ListMyFamilyCareLeaves(c).run({
    employeeId: viewer.employeeId,
    limit,
    offset,
  })

  if (familyCareLeaves instanceof Error) {
    throw new InternalError("failed to load family care leaves")
  }

  const responseBody = familyCareLeaves.map((familyCareLeave) => ({
    id: familyCareLeave.id,
    employee_id: familyCareLeave.employeeId,
    leave_kind: familyCareLeave.leaveKind,
    start_date: familyCareLeave.startDate,
    end_date: familyCareLeave.endDate,
    note: familyCareLeave.note,
    status: familyCareLeave.status,
    created_at: familyCareLeave.createdAt,
  }))

  return c.json(responseBody, 200)
})

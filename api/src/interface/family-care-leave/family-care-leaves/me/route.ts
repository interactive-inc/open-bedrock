import { ListMyFamilyCareLeaves } from "@/application/family-care-leave/list-my-family-care-leaves"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

// GET /family-care-leaves/me — 申出者本人の休業申出一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const familyCareLeaves = await new ListMyFamilyCareLeaves(c).run({
    employeeId: viewer.employeeId,
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

import { AdvanceFamilyCareLeave } from "@/application/family-care-leave/advance-family-care-leave"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zAppFamilyCareLeave } from "@/lib/app-schemas"
import { factory } from "@/lib/factory"
import { validateUuidParam } from "@/interface/utils/validate-uuid-param"
import { verifyBearer } from "@/interface/middleware/verify-bearer"

/** POST /family-care-leaves/:id/approve — 人事が産休・育休・介護休業の申出を承認する */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new AdvanceFamilyCareLeave(c).run({
    session: session,
    familyCareLeaveId: validateUuidParam(c.req.param("id"), "family care leave"),
    action: "approve",
  })

  if (updated instanceof ApplicationError) {
    throw toHttpException(updated)
  }

  const responseBody = zAppFamilyCareLeave.parse({
    id: updated.id,
    employee_id: updated.employeeId,
    leave_kind: updated.leaveKind,
    start_date: updated.startDate,
    end_date: updated.endDate,
    note: updated.note,
    status: updated.status,
    created_at: updated.createdAt,
  })

  return c.json(responseBody, 200)
})

import { AdvanceResignation } from "@/application/resignation/advance-resignation"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zAppResignation } from "@/lib/app-schemas"
import { factory } from "@/lib/factory"
import { validateUuidParam } from "@/interface/utils/validate-uuid-param"
import { verifyBearer } from "@/interface/middleware/verify-bearer"

/** POST /resignations/:id/accept — 人事が退職申請を受理する */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new AdvanceResignation(c).run({
    session: session,
    resignationId: validateUuidParam(c.req.param("id"), "resignation"),
    action: "accept",
  })

  if (updated instanceof ApplicationError) {
    throw toHttpException(updated)
  }

  const responseBody = zAppResignation.parse({
    id: updated.id,
    employee_id: updated.employeeId,
    resignation_date: updated.resignationDate,
    last_working_date: updated.lastWorkingDate,
    reason: updated.reason,
    status: updated.status,
    created_at: updated.createdAt,
  })

  return c.json(responseBody, 200)
})

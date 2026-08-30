import { AcceptResignation } from "@/contexts/resignation/application/accept-resignation"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { zAppResignation } from "@/contexts/resignation/interface/http/response-schemas"
import { factory } from "@/api/http/factory"
import { validateUuidParam } from "@/lib/http/validate-uuid-param"
import { verifyBearer } from "@/api/http/verify-bearer"

// @authorization service - session を application service に渡して判定する
/** POST /resignations/:id/accept — 人事が退職申請を受理する */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new AcceptResignation(c).execute({
    session: session,
    resignationId: validateUuidParam(c.req.param("id"), "resignation"),
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

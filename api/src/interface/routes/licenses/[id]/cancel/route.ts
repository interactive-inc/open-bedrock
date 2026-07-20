import { CancelLicense } from "@/application/license/cancel-license"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppLicense } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"

/** POST /licenses/:id/cancel — ライセンスを解約済みに倒す（license:manage、物理削除はしない） */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new CancelLicense(c).run({
    session,
    id: validateIntParam(c.req.param("id"), "license"),
  })

  if (updated instanceof ApplicationError) {
    throw toHttpException(updated)
  }

  const responseBody = zAppLicense.parse({
    id: updated.id,
    name: updated.name,
    vendor: updated.vendor,
    category: updated.category,
    seats: updated.seats,
    renewal_deadline: updated.renewalDeadline,
    owner_employee_id: updated.ownerEmployeeId,
    note: updated.note,
    status: updated.status,
    created_at: updated.createdAt,
  })

  return c.json(responseBody, 200)
})

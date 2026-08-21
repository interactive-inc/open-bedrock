import { CancelLicense } from "@/contexts/software-license/application/license/cancel-license"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppLicense } from "@/lib/app-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"

// @authorization service - session を application service に渡して判定する
/** POST /software-licenses/:id/cancel — ライセンスを解約済みに倒す（license:manage、物理削除はしない） */
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

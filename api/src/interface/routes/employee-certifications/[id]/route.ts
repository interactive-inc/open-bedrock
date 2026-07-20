import { DeleteEmployeeCertification } from "@/application/certification/delete-employee-certification"
import { canManageCertifications } from "@/lib/certification/can-manage-certifications"
import { factory } from "@/lib/factory"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { BadRequestError, ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"

/** DELETE /employee-certifications/:id — 資格保有記録を削除する。certification:manage が必要。 */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canManageCertifications(session) === false) {
    throw new ForbiddenError()
  }

  const id = Number(c.req.param("id"))

  if (Number.isInteger(id) === false) {
    throw new BadRequestError("invalid parameter")
  }

  const deleted = await new DeleteEmployeeCertification(c).run({ id })

  if (deleted instanceof Error) {
    throw toHttpException(deleted)
  }

  return c.body(null, 204)
})

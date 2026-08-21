import { EmployeeCertificationRepository } from "@/contexts/certification/infrastructure/employee-certification.repository"
import { NotFoundError, UnexpectedError } from "@/lib/errors"

import { factory } from "@/contexts/company/interface/utils/factory"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"

// @authorization permission - 権限キーで判定する
/** DELETE /employee-certifications/:id — 資格保有記録を削除する。certification:manage が必要。 */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("certification:manage") === false) {
    throw new ForbiddenError()
  }

  const id = Number(c.req.param("id"))

  if (Number.isInteger(id) === false) {
    throw new BadRequestError("invalid parameter")
  }

  const deleted = await (async () => {
    const props = { id }

    const repository = new EmployeeCertificationRepository(c)

    const deleted = await repository.delete(props.id)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete employee_certification", { cause: deleted })
    }

    if (deleted === null) {
      return new NotFoundError(
        "employee certification not found",
        "employee_certification_not_found",
      )
    }

    return true
  })()

  if (deleted instanceof Error) {
    throw toHttpException(deleted)
  }

  return c.body(null, 204)
})

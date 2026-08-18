import { DeleteEmployeeCertification } from "@/contexts/certification/application/delete-employee-certification"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"

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

  const deleted = await new DeleteEmployeeCertification(c).run({ id })

  if (deleted instanceof Error) {
    throw toHttpException(deleted)
  }

  return c.body(null, 204)
})

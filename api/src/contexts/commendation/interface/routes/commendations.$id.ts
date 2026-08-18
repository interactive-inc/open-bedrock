import { DeleteCommendation } from "@/contexts/commendation/application/delete-commendation"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { validateIntParam } from "@/contexts/company-compatibility/interface/utils/validate-int-param"

// @authorization service - session を application service に渡して判定する
/** DELETE /commendations/:id — 表彰の記録を削除（commendation:manage）。 */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteCommendation(c).run({
    session,
    id: validateIntParam(c.req.param("id"), "commendation"),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})

import { RevokeAccountRole } from "@/contexts/company/application/iam/revoke-account-role"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { NotFoundError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAccountId } from "@system/domain/auth/account-id"
import { validateCodeParam } from "@/contexts/company/interface/utils/validate-code-param"

// @authorization service - session を application service に渡して判定する
/** DELETE /accounts/:id/roles/:roleKey — アカウントからロールを剥奪（iam:assign_roles が必要） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const accountId = zAccountId.safeParse(c.req.param("id"))
  if (!accountId.success) throw new NotFoundError("account not found")

  const roleKey = validateCodeParam(c.req.param("roleKey"), "role")

  const result = await new RevokeAccountRole(c).run({
    session: session,
    accountId: accountId.data,
    roleKey: roleKey,
    now: c.env.NOW === undefined ? Date.now() : Date.parse(c.env.NOW),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})

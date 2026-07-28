import { RevokeAccountRole } from "@/application/iam/revoke-account-role"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { validateCodeParam } from "@/interface/utils/validate-code-param"

/** DELETE /accounts/:id/roles/:roleKey — アカウントからロールを剥奪（iam:assign_roles が必要） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const accountId = validateIntParam(c.req.param("id"), "account")

  const roleKey = validateCodeParam(c.req.param("roleKey"), "role")

  const result = await new RevokeAccountRole(c).run({
    session: session,
    accountId: accountId,
    roleKey: roleKey,
    now: c.env.NOW === undefined ? Date.now() : Date.parse(c.env.NOW),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})

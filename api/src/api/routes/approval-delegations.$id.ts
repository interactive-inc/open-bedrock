import {
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { resolveActiveSystemAccountId } from "@/contexts/company/application/iam/resolve-active-system-account-id"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import { SystemD1ProcedureDelegationRepository } from "@system/infrastructure/workflow/system-d1-procedure-delegation-repository"

// @authorization owner - 委任元本人だけが取消できる
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const accountId = await resolveActiveSystemAccountId(c, session.accountId)
  if (accountId instanceof Error) throw new InternalError("failed to resolve canonical actor")
  const result = await new SystemD1ProcedureDelegationRepository({ env: { DB: c.env.DB } }).revoke({
    number: validateIntParam(c.req.param("id"), "delegation"),
    delegatorAccountId: accountId,
    revokedAt: new Date(c.env.NOW ?? Date.now()),
  })
  if (result === "not_found") throw new NotFoundError("delegation not found")
  if (result instanceof Error) throw new InternalError("failed to revoke delegation")

  return c.body(null, 204)
})

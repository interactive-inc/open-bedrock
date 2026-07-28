import { ManageGovernanceOrgRole } from "@/application/governance/manage-governance-org-role"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"

// @authorization service - session を application service に渡して判定する
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const assignmentId = validateIntParam(c.req.param("id"), "governance assignment")
  const result = await new ManageGovernanceOrgRole(c).revoke({ session, assignmentId })
  if (result instanceof ApplicationError) throw toHttpException(result)
  return c.body(null, 204)
})

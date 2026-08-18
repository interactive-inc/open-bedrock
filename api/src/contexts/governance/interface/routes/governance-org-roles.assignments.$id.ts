import { ManageGovernanceOrgRole } from "@/contexts/governance/application/manage-governance-org-role"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { validateIntParam } from "@/contexts/company-compatibility/interface/utils/validate-int-param"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"

// @authorization service - session を application service に渡して判定する
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const assignmentId = validateIntParam(c.req.param("id"), "governance assignment")
  const result = await new ManageGovernanceOrgRole(c).revoke({ session, assignmentId })
  if (result instanceof ApplicationError) throw toHttpException(result)
  return c.body(null, 204)
})

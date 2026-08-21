import { ManageGovernanceOrgRole } from "@/contexts/governance/application/manage-governance-org-role"
import { prepareGovernanceAudit } from "@/api/http/audit/prepare-governance-audit"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"

// @authorization service - session を application service に渡して判定する
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const assignmentId = validateIntParam(c.req.param("id"), "governance assignment")
  const result = await new ManageGovernanceOrgRole(c, (audit) =>
    prepareGovernanceAudit({ c, ...audit }),
  ).revoke({ session, assignmentId })
  if (result instanceof ApplicationError) throw toHttpException(result)
  return c.body(null, 204)
})

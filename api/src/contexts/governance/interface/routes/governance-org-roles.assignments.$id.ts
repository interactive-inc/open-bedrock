import { RevokeGovernanceOrgRole } from "@/contexts/governance/application/revoke-governance-org-role"
import { prepareGovernanceAudit } from "@/api/http/audit/prepare-governance-audit"
import { factory } from "@/api/http/factory"
import { ApplicationError, ValidationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"

// @authorization service - session を application service に渡して判定する
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const assignmentId = c.req.param("id")
  const commandId = c.req.header("idempotency-key")
  const expectedRevision = Number(c.req.header("if-match"))
  if (
    assignmentId === undefined ||
    !/^\S{1,255}$/.test(assignmentId) ||
    commandId === undefined ||
    !/^\S{1,255}$/.test(commandId) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0
  ) {
    throw toHttpException(
      new ValidationError(
        "任命ID、冪等キー、期待会社版が必要です",
        "governance_role_headers_invalid",
      ),
    )
  }
  const result = await new RevokeGovernanceOrgRole({
    context: c,
    prepareAudit: (audit) => prepareGovernanceAudit({ c, ...audit }),
  }).execute({ session, commandId, expectedRevision, assignmentId })
  if (result instanceof ApplicationError) throw toHttpException(result)
  if (result instanceof Error) throw result
  c.header("etag", `"${result.organizationRevision}"`)
  return c.body(null, 204)
})

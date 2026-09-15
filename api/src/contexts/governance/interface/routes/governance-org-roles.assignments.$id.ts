import { RevokeGovernanceOrgRole } from "@/contexts/governance/application/revoke-governance-org-role"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyGovernanceRoleAssignmentWriteAdapter } from "@/contexts/governance/infrastructure/adapters/company-governance-role-assignment-write.adapter"
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
    revoke: (props) =>
      new CompanyGovernanceRoleAssignmentWriteAdapter({
        actor: CompanyActorValue.restore({
          accountId: String(props.session.accountId),
          employeeId: String(props.session.employeeId),
          organizationIds: ["organization:default"],
          capabilities: ["company:write"],
        }),
        database: c.env.DB,
        auditStatements: prepareGovernanceAudit({
          c,
          session: props.session,
          action: "governance.org_role.revoked",
          targetType: "governance_org_role",
          targetId: props.assignmentId,
          metadata: { assignment_id: props.assignmentId },
        }),
      }).revoke({
        organizationId: "organization:default",
        commandId: props.commandId,
        expectedRevision: props.expectedRevision,
        assignmentId: props.assignmentId,
        recordedAt: new Date(c.env.NOW ?? Date.now()).getTime(),
      }),
  }).execute({ session, commandId, expectedRevision, assignmentId })
  if (result instanceof ApplicationError) throw toHttpException(result)
  if (result instanceof Error) throw result
  c.header("etag", `"${result.organizationRevision}"`)
  return c.body(null, 204)
})

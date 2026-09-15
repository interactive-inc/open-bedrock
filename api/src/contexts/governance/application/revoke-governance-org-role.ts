import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { SystemJsonValue } from "@system/domain/definitions/audit/system-json-value.definition"
import { CompanyGovernanceRoleAssignmentWriteAdapter } from "@/contexts/governance/infrastructure/adapters/company-governance-role-assignment-write.adapter"
import type { Context as HonoContext } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"

type Context = Readonly<{
  context: HonoContext
  prepareAudit: (props: {
    session: CompanySessionValue
    action: "governance.org_role.revoked"
    targetType: "governance_org_role"
    targetId: string
    metadata?: SystemJsonValue
  }) => ReadonlyArray<D1PreparedStatement>
}>

/** 組織責任の割当をCompanyの取消履歴として解除する。 */
export class RevokeGovernanceOrgRole {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: {
    session: CompanySessionValue
    commandId: string
    expectedRevision: number
    assignmentId: string
  }) {
    if (!props.session.permissions.has("governance:manage")) {
      return new ForbiddenError("組織責任を解除する権限がありません", "governance_role_forbidden")
    }
    const result = await new CompanyGovernanceRoleAssignmentWriteAdapter({
      actor: CompanyActorValue.restore({
        accountId: String(props.session.accountId),
        employeeId: String(props.session.employeeId),
        organizationIds: ["organization:default"],
        capabilities: ["company:write"],
      }),
      database: this.c.context.env.DB,
      auditStatements: this.c.prepareAudit({
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
      recordedAt: new Date(this.c.context.env.NOW ?? Date.now()).getTime(),
    })
    if (result.kind === "revoked") return result
    if (result.kind === "forbidden") {
      return new ForbiddenError("会社の責務を変更する権限がありません", "governance_role_forbidden")
    }
    if (result.kind === "conflict") {
      return new ConflictError("会社版が更新されています", "governance_role_revision_conflict")
    }
    if (result.kind === "command_conflict") {
      return new ConflictError(
        "冪等キーが別の操作に使われています",
        "governance_role_command_conflict",
      )
    }
    if (result.kind === "resource_conflict") {
      return new ConflictError("組織責任の版が更新されています", "governance_role_conflict")
    }
    if (result.kind === "invalid") {
      return new NotFoundError("組織責任の割当がありません", "governance_assignment_not_found")
    }
    return new UnexpectedError("組織責任を解除できません", { cause: result.cause })
  }
}

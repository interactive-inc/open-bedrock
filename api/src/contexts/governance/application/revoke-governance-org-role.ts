import type { Session } from "@/lib/auth/session"
import type { SystemJsonValue } from "@system/domain/definitions/audit/system-json-value.definition"
import type { Context as HonoContext } from "@/env"
import {
  GovernanceAdapter,
  type GovernanceAuditStatements,
} from "@/contexts/governance/infrastructure/adapters/governance.adapter"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"

type Context = Readonly<{
  context: HonoContext
  prepareAudit: (props: {
    session: Session
    action: "governance.org_role.revoked"
    targetType: "governance_org_role"
    targetId: string
    metadata?: SystemJsonValue
  }) => GovernanceAuditStatements
}>

/** 組織責任の割当を解除する。 */
export class RevokeGovernanceOrgRole {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: { session: Session; assignmentId: number }) {
    if (!props.session.permissions.has("governance:manage")) {
      return new ForbiddenError("組織責任を解除する権限がありません", "governance_role_forbidden")
    }

    const result = await new GovernanceAdapter(this.c.context).revokeAssignment({
      id: props.assignmentId,
      accountId: props.session.accountId,
      revokedAt: this.c.context.env.NOW ?? new Date().toISOString(),
      auditStatements: this.c.prepareAudit({
        session: props.session,
        action: "governance.org_role.revoked",
        targetType: "governance_org_role",
        targetId: String(props.assignmentId),
        metadata: { assignment_id: props.assignmentId },
      }),
    })
    if (result instanceof Error) {
      return new UnexpectedError("組織責任を解除できません", { cause: result })
    }

    return result
      ? null
      : new NotFoundError("組織責任の割当がありません", "governance_assignment_not_found")
  }
}

import type { Session } from "@/lib/auth/session"
import type { SystemJsonValue } from "@system/domain/definitions/audit/system-json-value.definition"
import type { Context as HonoContext } from "@/env"
import {
  GovernanceAdapter,
  type GovernanceAuditStatements,
} from "@/contexts/governance/infrastructure/adapters/governance.adapter"
import { GovernanceAccessAdapter } from "@/contexts/governance/infrastructure/adapters/governance-access.adapter"
import { ResolveGovernanceOrgRoleAdapter } from "@/contexts/governance/infrastructure/adapters/resolve-governance-org-role.adapter"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"

type Context = Readonly<{
  context: HonoContext
  prepareAudit: (props: {
    session: Session
    action: "governance.review.decided"
    targetType: "governance_version"
    targetId: string
    metadata?: SystemJsonValue
  }) => GovernanceAuditStatements
}>

/** 規程版の審査を却下する。 */
export class RejectGovernanceReview {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: {
    session: Session
    code: string
    version: string
    orgRoleCode: string
    comment: string | null
  }): Promise<{ state: "approved" | "rejected" } | Error> {
    if (
      !new GovernanceAccessAdapter({
        context: this.c.context,
        session: props.session,
      }).canReview()
    ) {
      return new ForbiddenError("規程版を審査する権限がありません", "governance_review_forbidden")
    }
    const loaded = await this.load(props.code, props.version)
    if (loaded instanceof Error) return loaded
    if (loaded.version.row.state !== "in_review") {
      return new ConflictError("審査中の規程版ではありません", "governance_review_state")
    }
    if (!loaded.version.metadata.publication.approver_org_roles.includes(props.orgRoleCode)) {
      return new ForbiddenError("この組織ロールは審査候補ではありません", "governance_review_role")
    }
    const assignees = await new ResolveGovernanceOrgRoleAdapter(
      this.c.context,
    ).resolveGovernanceOrgRole(props.orgRoleCode)
    if (assignees instanceof Error) {
      return new UnexpectedError("審査担当を解決できません", { cause: assignees })
    }
    if (!assignees.some((assignee) => assignee.employee_id === props.session.employeeId)) {
      return new ForbiddenError(
        "現在の組織関係ではこの審査を実行できません",
        "governance_review_scope",
      )
    }
    const result = await new GovernanceAdapter(this.c.context).decideReview({
      versionId: loaded.version.row.id,
      orgRoleCode: props.orgRoleCode,
      decision: "rejected",
      employeeId: props.session.employeeId,
      decidedAt: this.c.context.env.NOW ?? new Date().toISOString(),
      comment: props.comment,
      auditStatements: this.c.prepareAudit({
        session: props.session,
        action: "governance.review.decided",
        targetType: "governance_version",
        targetId: loaded.version.row.id,
        metadata: {
          document_code: props.code,
          version: props.version,
          org_role_code: props.orgRoleCode,
          decision: "rejected",
        },
      }),
    })
    if (result instanceof Error) {
      return new UnexpectedError("規程版の審査結果を保存できません", { cause: result })
    }
    if (!result) return new ConflictError("審査は既に処理されています", "governance_review_decided")
    return { state: "rejected" }
  }

  private async load(code: string, version: string) {
    const repository = new GovernanceAdapter(this.c.context)
    const document = await repository.findDocument(code)
    if (document instanceof Error) {
      return new UnexpectedError("規程を取得できません", { cause: document })
    }
    if (document === null) return new NotFoundError("規程がありません", "governance_not_found")
    const loadedVersion = await repository.findVersion(document.id, version)
    if (loadedVersion instanceof Error) {
      return new UnexpectedError("規程版を取得できません", { cause: loadedVersion })
    }
    if (loadedVersion === null) {
      return new NotFoundError("規程版がありません", "governance_version_not_found")
    }
    return { document, version: loadedVersion }
  }
}

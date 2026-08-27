import type { Session } from "@/lib/auth/session"
import type { SystemJsonValue } from "@system/domain/definitions/audit/system-json-value.definition"
import type { Context as HonoContext } from "@/env"
import {
  GovernanceAdapter,
  type GovernanceAuditStatements,
} from "@/contexts/governance/infrastructure/adapters/governance.adapter"
import { ResolveGovernanceOrgRoleAdapter } from "@/contexts/governance/infrastructure/adapters/resolve-governance-org-role.adapter"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  UnprocessableError,
} from "@/lib/errors"

type Context = Readonly<{
  context: HonoContext
  prepareAudit: (props: {
    session: Session
    action: "governance.review.submitted"
    targetType: "governance_version"
    targetId: string
    metadata?: SystemJsonValue
  }) => GovernanceAuditStatements
}>

/** 規程版を審査へ提出する。 */
export class SubmitGovernanceReview {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: {
    session: Session
    code: string
    version: string
  }): Promise<{ state: "in_review"; approver_org_roles: ReadonlyArray<string> } | Error> {
    if (!props.session.permissions.has("governance:manage")) {
      return new ForbiddenError(
        "規程版を審査へ提出する権限がありません",
        "governance_submit_forbidden",
      )
    }
    const loaded = await this.load(props.code, props.version)
    if (loaded instanceof Error) return loaded
    if (loaded.version.row.state !== "draft") {
      return new ConflictError("下書きだけを審査へ提出できます", "governance_review_state")
    }
    if (loaded.version.metadata.publication.mode !== "approval") {
      return new ConflictError("この規程版は直接公開方式です", "governance_review_not_required")
    }
    const roles = loaded.version.metadata.publication.approver_org_roles
    const resolved = await Promise.all(
      roles.map((code) =>
        new ResolveGovernanceOrgRoleAdapter(this.c.context).resolveGovernanceOrgRole(code),
      ),
    )
    const roleError = resolved.find((item) => item instanceof Error)
    if (roleError instanceof Error) {
      return new UnexpectedError("審査担当を解決できません", { cause: roleError })
    }
    const emptyRoleIndex = resolved.findIndex(
      (item) => !(item instanceof Error) && item.length === 0,
    )
    if (emptyRoleIndex >= 0) {
      return new UnprocessableError(
        `審査組織ロールが未充足です: ${roles[emptyRoleIndex] ?? "unknown"}`,
        "governance_reviewer_unassigned",
      )
    }
    const result = await new GovernanceAdapter(this.c.context).submitForReview({
      versionId: loaded.version.row.id,
      approverOrgRoles: roles,
      auditStatements: this.c.prepareAudit({
        session: props.session,
        action: "governance.review.submitted",
        targetType: "governance_version",
        targetId: loaded.version.row.id,
        metadata: { document_code: props.code, version: props.version, approver_org_roles: roles },
      }),
    })
    return result instanceof Error
      ? new UnexpectedError("規程版を審査へ提出できません", { cause: result })
      : { state: "in_review", approver_org_roles: roles }
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

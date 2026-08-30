import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { SystemJsonValue } from "@system/domain/definitions/audit/system-json-value.definition"
import type { Context as HonoContext } from "@/env"
import {
  GovernanceAdapter,
  type GovernanceAuditStatements,
} from "@/contexts/governance/infrastructure/adapters/governance.adapter"
import { GovernanceAccessAdapter } from "@/contexts/governance/infrastructure/adapters/governance-access.adapter"
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
    session: CompanySessionValue
    action: "governance.document.published"
    targetType: "governance_version"
    targetId: string
    metadata?: SystemJsonValue
  }) => GovernanceAuditStatements
}>

/** 規程版を公開する。 */
export class PublishGovernanceDocument {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: {
    session: CompanySessionValue
    code: string
    version: string
  }): Promise<{ state: "published"; version_id: string } | Error> {
    if (
      !new GovernanceAccessAdapter({
        context: this.c.context,
        session: props.session,
      }).canPublish()
    ) {
      return new ForbiddenError("規程版を公開する権限がありません", "governance_publish_forbidden")
    }
    const loaded = await this.load(props.code, props.version)
    if (loaded instanceof Error) return loaded
    const metadata = loaded.version.metadata
    if (metadata.kind === "policy" && metadata.effective_from === null) {
      return new UnprocessableError(
        "規程の公開には施行日が必要です",
        "governance_effective_date_required",
      )
    }
    if (loaded.version.row.state === "published") {
      return { state: "published", version_id: loaded.version.row.id }
    }
    if (loaded.version.row.state === "superseded") {
      return new ConflictError("廃止済みの版は再公開できません", "governance_version_superseded")
    }
    if (metadata.publication.mode === "approval") {
      if (loaded.version.row.state !== "in_review") {
        return new ConflictError("審査を開始していません", "governance_review_required")
      }
      if (
        loaded.version.approvals.length !== metadata.publication.approver_org_roles.length ||
        loaded.version.approvals.some((approval) => approval.status !== "approved")
      ) {
        return new ConflictError(
          "必要な組織ロールの承認が揃っていません",
          "governance_approval_pending",
        )
      }
    } else if (loaded.version.row.state !== "draft") {
      return new ConflictError("直接公開できる下書きではありません", "governance_publish_state")
    }
    const result = await new GovernanceAdapter(this.c.context).publish({
      document: loaded.document,
      version: loaded.version,
      accountId: props.session.accountId,
      now: this.c.context.env.NOW ?? new Date().toISOString(),
      auditStatements: this.c.prepareAudit({
        session: props.session,
        action: "governance.document.published",
        targetType: "governance_version",
        targetId: loaded.version.row.id,
        metadata: { document_code: props.code, version: props.version },
      }),
    })
    return result instanceof Error
      ? new UnexpectedError("規程版を公開できません", { cause: result })
      : { state: "published", version_id: loaded.version.row.id }
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

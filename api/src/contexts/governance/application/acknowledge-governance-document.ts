import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { SystemJsonValue } from "@system/domain/definitions/audit/system-json-value.definition"
import type { Context as HonoContext } from "@/env"
import {
  GovernanceAdapter,
  type GovernanceAuditStatements,
} from "@/contexts/governance/infrastructure/adapters/governance.adapter"
import { GovernanceAccessAdapter } from "@/contexts/governance/infrastructure/adapters/governance-access.adapter"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"

type Context = Readonly<{
  context: HonoContext
  prepareAudit: (props: {
    session: CompanySessionValue
    action: "governance.document.acknowledged"
    targetType: "governance_version"
    targetId: string
    metadata?: SystemJsonValue
  }) => GovernanceAuditStatements
}>

/** 規程を確認済みにする。 */
export class AcknowledgeGovernanceDocument {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: {
    session: CompanySessionValue
    code: string
  }): Promise<{ acknowledged_at: string; content_hash: string } | Error> {
    if (!props.session.permissions.has("governance:acknowledge")) {
      return new ForbiddenError("規程を確認する権限がありません", "governance_ack_forbidden")
    }
    const repository = new GovernanceAdapter(this.c.context)
    const record = await repository.findVisibleRecord({ code: props.code, includeDraft: false })
    if (record instanceof Error) {
      return new UnexpectedError("規程を取得できません", { cause: record })
    }
    if (record === null || record.version === null) {
      return new NotFoundError("公開済みの規程がありません", "governance_not_found")
    }
    const audience = await new GovernanceAccessAdapter({
      context: this.c.context,
      session: props.session,
    }).isAudienceMember(record.version.metadata)
    if (audience instanceof Error) {
      return new UnexpectedError("規程の適用対象を判定できません", { cause: audience })
    }
    if (!audience) {
      return new ForbiddenError("この規程の適用対象ではありません", "governance_ack_scope")
    }
    const acknowledgedAt = this.c.context.env.NOW ?? new Date().toISOString()
    const result = await repository.acknowledge({
      versionId: record.version.row.id,
      employeeId: props.session.employeeId,
      contentHash: record.version.row.contentHash,
      acknowledgedAt,
      auditStatements: this.c.prepareAudit({
        session: props.session,
        action: "governance.document.acknowledged",
        targetType: "governance_version",
        targetId: record.version.row.id,
        metadata: { document_code: props.code, content_hash: record.version.row.contentHash },
      }),
    })
    return result instanceof Error
      ? new UnexpectedError("規程の確認を記録できません", { cause: result })
      : { acknowledged_at: acknowledgedAt, content_hash: record.version.row.contentHash }
  }
}

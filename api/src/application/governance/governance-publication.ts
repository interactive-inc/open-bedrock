import type { Session } from "@/contexts/company/domain/iam/session"
import type { Context } from "@/env"
import { GovernanceRepository } from "@/infrastructure/governance/governance-repository"
import { GovernanceAccess } from "@/application/governance/governance-access"
import { resolveGovernanceOrgRole } from "@/application/governance/resolve-governance-org-role"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  UnprocessableError,
} from "@/lib/errors"
import { prepareGovernanceAudit } from "@/application/governance/governance-audit"

export class GovernancePublication {
  constructor(private readonly c: Context) {}

  async submitReview(props: {
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
      roles.map((code) => resolveGovernanceOrgRole({ c: this.c, code })),
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
    const result = await new GovernanceRepository(this.c).submitForReview({
      versionId: loaded.version.row.id,
      approverOrgRoles: roles,
      auditStatements: prepareGovernanceAudit({
        c: this.c,
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

  async decideReview(props: {
    session: Session
    code: string
    version: string
    orgRoleCode: string
    decision: "approved" | "rejected"
    comment: string | null
  }): Promise<{ state: "approved" | "rejected" } | Error> {
    if (!new GovernanceAccess({ c: this.c, session: props.session }).canReview()) {
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
    const assignees = await resolveGovernanceOrgRole({ c: this.c, code: props.orgRoleCode })
    if (assignees instanceof Error) {
      return new UnexpectedError("審査担当を解決できません", { cause: assignees })
    }
    if (!assignees.some((assignee) => assignee.employee_id === props.session.employeeId)) {
      return new ForbiddenError(
        "現在の組織関係ではこの審査を実行できません",
        "governance_review_scope",
      )
    }
    const result = await new GovernanceRepository(this.c).decideReview({
      versionId: loaded.version.row.id,
      orgRoleCode: props.orgRoleCode,
      decision: props.decision,
      employeeId: props.session.employeeId,
      decidedAt: this.c.env.NOW ?? new Date().toISOString(),
      comment: props.comment,
      auditStatements: prepareGovernanceAudit({
        c: this.c,
        session: props.session,
        action: "governance.review.decided",
        targetType: "governance_version",
        targetId: loaded.version.row.id,
        metadata: {
          document_code: props.code,
          version: props.version,
          org_role_code: props.orgRoleCode,
          decision: props.decision,
        },
      }),
    })
    if (result instanceof Error) {
      return new UnexpectedError("規程版の審査結果を保存できません", { cause: result })
    }
    if (!result) return new ConflictError("審査は既に処理されています", "governance_review_decided")
    return { state: props.decision }
  }

  async publish(props: {
    session: Session
    code: string
    version: string
  }): Promise<{ state: "published"; version_id: string } | Error> {
    if (!new GovernanceAccess({ c: this.c, session: props.session }).canPublish()) {
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
    const result = await new GovernanceRepository(this.c).publish({
      document: loaded.document,
      version: loaded.version,
      accountId: props.session.accountId,
      now: this.c.env.NOW ?? new Date().toISOString(),
      auditStatements: prepareGovernanceAudit({
        c: this.c,
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

  async acknowledge(props: {
    session: Session
    code: string
  }): Promise<{ acknowledged_at: string; content_hash: string } | Error> {
    if (!props.session.permissions.has("governance:acknowledge")) {
      return new ForbiddenError("規程を確認する権限がありません", "governance_ack_forbidden")
    }
    const repository = new GovernanceRepository(this.c)
    const record = await repository.findVisibleRecord({ code: props.code, includeDraft: false })
    if (record instanceof Error) {
      return new UnexpectedError("規程を取得できません", { cause: record })
    }
    if (record === null || record.version === null) {
      return new NotFoundError("公開済みの規程がありません", "governance_not_found")
    }
    const audience = await new GovernanceAccess({
      c: this.c,
      session: props.session,
    }).isAudienceMember(record.version.metadata)
    if (audience instanceof Error) {
      return new UnexpectedError("規程の適用対象を判定できません", { cause: audience })
    }
    if (!audience) {
      return new ForbiddenError("この規程の適用対象ではありません", "governance_ack_scope")
    }
    const acknowledgedAt = this.c.env.NOW ?? new Date().toISOString()
    const result = await repository.acknowledge({
      versionId: record.version.row.id,
      employeeId: props.session.employeeId,
      contentHash: record.version.row.contentHash,
      acknowledgedAt,
      auditStatements: prepareGovernanceAudit({
        c: this.c,
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

  private async load(code: string, version: string) {
    const repository = new GovernanceRepository(this.c)
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

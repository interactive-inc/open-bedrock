import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { findGovernanceOrgRole } from "@/contexts/governance/domain/catalogs/governance-org-role.catalog"
import { CompanyGovernanceRoleAssignmentWriteAdapter } from "@/contexts/governance/infrastructure/adapters/company-governance-role-assignment-write.adapter"
import { GovernanceRoleAssignmentAdoptionSnapshotAdapter } from "@/contexts/governance/infrastructure/adapters/governance-role-assignment-adoption-snapshot.adapter"
import type { Bindings } from "@/env"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import type { SystemJsonValue } from "@system/domain/definitions/audit/system-json-value.definition"

type Context = Readonly<{
  context: Readonly<{
    env: Pick<Bindings, "DB" | "NOW"> & Readonly<{ RECORD_SOURCE_NAMESPACE?: string }>
  }>
  prepareAudit: (props: {
    session: CompanySessionValue
    action: "governance.org_role.assigned"
    targetType: "governance_org_role"
    targetId: string
    metadata?: SystemJsonValue
  }) => ReadonlyArray<D1PreparedStatement>
}>

/** 凍結した旧組織ロール割当を、元記録の証跡とともにCompany責務履歴へ接続する。 */
export class AdoptGovernanceOrgRoleAssignment {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: {
    session: CompanySessionValue
    assignmentId: number
    freezeId: string
    commandId: string
    expectedRevision: number
    snapshotDigest: string
  }) {
    if (!props.session.permissions.has("governance:manage")) {
      return new ForbiddenError("組織責任を移行する権限がありません", "governance_role_forbidden")
    }
    const sourceNamespace = this.c.context.env.RECORD_SOURCE_NAMESPACE
    if (sourceNamespace === undefined) {
      return new UnexpectedError("組織責任の移行元を特定できません")
    }
    const freeze = await this.c.context.env.DB.prepare(`SELECT id
      FROM system_record_source_freezes
      WHERE id = ?1 AND source_namespace = ?2 AND owner_context = 'governance' AND revision = 1`)
      .bind(props.freezeId, sourceNamespace)
      .first()
    if (freeze === null) {
      return new ConflictError(
        "組織責任の元台帳を停止してから移行してください",
        "governance_role_source_not_frozen",
      )
    }

    const snapshot = await new GovernanceRoleAssignmentAdoptionSnapshotAdapter(
      this.c.context.env.DB,
    ).find(props.assignmentId)
    if (snapshot instanceof Error) {
      return new UnexpectedError("組織責任の元記録を確認できません", { cause: snapshot })
    }
    if (snapshot === null) {
      return new NotFoundError("組織責任の元記録がありません", "governance_assignment_not_found")
    }
    if (snapshot.snapshotDigest !== props.snapshotDigest) {
      return new ConflictError("組織責任の元記録が変更されています", "governance_role_source_conflict")
    }
    const role = findGovernanceOrgRole(snapshot.source.org_role_code)
    if (role === null || role.assignmentMode !== "manual") {
      return new ValidationError("組織責任の定義が移行できません", "governance_role_source_invalid")
    }

    const recordedAt = new Date(this.c.context.env.NOW ?? Date.now()).getTime()
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
        action: "governance.org_role.assigned",
        targetType: "governance_org_role",
        targetId: snapshot.source.org_role_code,
        metadata: {
          source_context: "governance",
          source_kind: "org-role-assignment",
          source_id: String(snapshot.source.id),
          source_digest: snapshot.snapshotDigest,
        },
      }),
    }).assign({
      organizationId: "organization:default",
      commandId: props.commandId,
      expectedRevision: props.expectedRevision,
      responsibilityCode: role.code,
      responsibilityName: role.name,
      cardinality: role.cardinality,
      employeeCode: snapshot.source.employee_code,
      departmentCode: snapshot.source.department_code,
      startsOn: restoreCalendarDate(snapshot.source.starts_on),
      endsOn:
        snapshot.source.ends_on === null
          ? null
          : restoreCalendarDate(snapshot.source.ends_on),
      sourceDocumentCode: snapshot.source.source_document_code,
      recordedAt,
      voided: snapshot.source.revoked_at !== null,
      prepareAdditionalStatements: (assignment) => [
        this.c.context.env.DB.prepare(`INSERT INTO company_responsibility_source_adoptions
          (organization_id, source_context, source_kind, source_namespace, freeze_id,
           source_id, source_version,
           command_id, resource_type, resource_id, resource_revision, snapshot_digest,
           source_json, actor_account_id, reason, expected_revision, organization_revision,
           recorded_at)
         VALUES ('organization:default', 'governance', 'org-role-assignment', ?1, ?2,
           ?3, ?4, ?5, 'responsibility-assignment', ?6, ?7, ?4, ?8, ?9, ?10, ?11, ?12, ?13)`)
          .bind(
            sourceNamespace,
            props.freezeId,
            String(snapshot.source.id),
            snapshot.snapshotDigest,
            props.commandId,
            assignment.assignmentId,
            assignment.resourceRevision,
            snapshot.sourceJson,
            assignment.actorAccountId,
            assignment.reason,
            assignment.expectedRevision,
            assignment.organizationRevision,
            assignment.recordedAt,
          ),
      ],
    })
    if (result.kind === "assigned") return result
    if (result.kind === "forbidden") {
      return new ForbiddenError("Companyの責務を変更する権限がありません", "governance_role_forbidden")
    }
    if (result.kind === "conflict") {
      return new ConflictError("会社版が更新されています", "governance_role_revision_conflict")
    }
    if (result.kind === "command_conflict") {
      return new ConflictError("冪等キーが別の操作に使われています", "governance_role_command_conflict")
    }
    if (result.kind === "overlap") {
      return new ConflictError("移行先の組織責任と重複します", "governance_role_overlap")
    }
    if (result.kind === "resource_conflict") {
      return new ConflictError("移行先の責務履歴が更新されています", "governance_role_resource_conflict")
    }
    if (result.kind === "invalid") {
      return new ValidationError("Companyの責務参照が不正です", "governance_role_reference_invalid")
    }
    return new UnexpectedError("組織責任をCompanyへ移行できません", { cause: result.cause })
  }
}

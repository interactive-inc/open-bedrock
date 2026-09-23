import { openCompanyResponsibilitySourceLedger } from "@/contexts/company/interface/operations/open-company-responsibility-source-ledger"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { findGovernanceOrgRole } from "@/contexts/governance/domain/catalogs/governance-org-role.catalog"
import { CompanyGovernanceRoleAssignmentWriteAdapter } from "@/contexts/governance/infrastructure/adapters/company-governance-role-assignment-write.adapter"
import { GovernanceRoleAssignmentAdoptionSnapshotAdapter } from "@/contexts/governance/infrastructure/adapters/governance-role-assignment-adoption-snapshot.adapter"
import type { SystemJsonValue } from "@system/domain/definitions/audit/system-json-value.definition"

const governanceResponsibilitySource = {
  organizationId: "organization:default",
  sourceContext: "governance",
  sourceKind: "org-role-assignment",
} as const

type Context = Readonly<{
  database: D1Database
  now?: string | number
  timeZone?: string
  sourceNamespace?: string
  prepareAudit: (props: {
    session: CompanySessionValue
    action: "governance.org_role.assigned"
    targetType: "governance_org_role"
    targetId: string
    metadata?: SystemJsonValue
  }) => ReadonlyArray<D1PreparedStatement>
}>

export type GovernanceOrgRoleAssignmentAdoptionResult =
  | Awaited<ReturnType<CompanyGovernanceRoleAssignmentWriteAdapter["assign"]>>
  | Readonly<{ kind: "source_namespace_missing" }>
  | Readonly<{ kind: "source_not_frozen" }>
  | Readonly<{ kind: "source_unavailable"; cause: Error }>
  | Readonly<{ kind: "source_not_found" }>
  | Readonly<{ kind: "source_conflict" }>
  | Readonly<{ kind: "source_invalid" }>

/** 旧組織責任の停止確認とCompanyへの原子的な移行を永続化境界で実行する。 */
export class GovernanceOrgRoleAssignmentAdoptionAdapter {
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
  }): Promise<GovernanceOrgRoleAssignmentAdoptionResult> {
    const sourceNamespace = this.c.sourceNamespace
    if (sourceNamespace === undefined) return { kind: "source_namespace_missing" }
    const freeze = await this.c.database
      .prepare(`SELECT id FROM system_record_source_freezes
      WHERE id = ?1 AND source_namespace = ?2 AND owner_context = 'governance' AND revision = 1`)
      .bind(props.freezeId, sourceNamespace)
      .first()
    if (freeze === null) return { kind: "source_not_frozen" }
    const snapshot = await new GovernanceRoleAssignmentAdoptionSnapshotAdapter({
      database: this.c.database,
      now: this.c.now,
      timeZone: this.c.timeZone,
    }).find(props.assignmentId)
    if (snapshot instanceof Error) return { kind: "source_unavailable", cause: snapshot }
    if (snapshot === null) return { kind: "source_not_found" }
    if (snapshot.snapshotDigest !== props.snapshotDigest) return { kind: "source_conflict" }
    const role = findGovernanceOrgRole(snapshot.source.org_role_code)
    if (role === null || role.assignmentMode !== "manual") return { kind: "source_invalid" }
    return new CompanyGovernanceRoleAssignmentWriteAdapter({
      actor: CompanyActorValue.restore({
        accountId: String(props.session.accountId),
        employeeId: String(props.session.employeeId),
        organizationIds: ["organization:default"],
        capabilities: ["company:write"],
      }),
      database: this.c.database,
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
        snapshot.source.ends_on === null ? null : restoreCalendarDate(snapshot.source.ends_on),
      sourceDocumentCode: snapshot.source.source_document_code,
      recordedAt: new Date(this.c.now ?? Date.now()).getTime(),
      voided: snapshot.source.revoked_at !== null,
      additionalPayload: {
        sourceNamespace,
        freezeId: props.freezeId,
        sourceId: String(snapshot.source.id),
        snapshotDigest: snapshot.snapshotDigest,
      },
      prepareAdditionalStatements: (assignment) => [
        openCompanyResponsibilitySourceLedger(this.c.database).prepareAdoption({
          ...governanceResponsibilitySource,
          sourceNamespace,
          freezeId: props.freezeId,
          sourceId: String(snapshot.source.id),
          snapshotDigest: snapshot.snapshotDigest,
          sourceJson: snapshot.sourceJson,
          commandId: props.commandId,
          resourceId: assignment.assignmentId,
          resourceRevision: assignment.resourceRevision,
          actorAccountId: assignment.actorAccountId,
          reason: assignment.reason,
          expectedRevision: assignment.expectedRevision,
          organizationRevision: assignment.organizationRevision,
          recordedAt: assignment.recordedAt,
        }),
      ],
    })
  }
}

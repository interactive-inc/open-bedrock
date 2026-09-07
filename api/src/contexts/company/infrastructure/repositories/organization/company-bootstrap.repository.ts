import type { CompanyBootstrapEntity } from "@/contexts/company/domain/entities/company-bootstrap.entity"
import {
  CompanyConflictError,
  CompanyUnavailableError,
  CompanyValidationError,
  type CompanyOperationError,
} from "@/contexts/company/domain/errors"
import { InitialCompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/organization/initial-company-resource-journal.adapter"
import { OrganizationResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/organization/organization-resource-adoption-snapshot.adapter"
import { InitialWorkforceResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/employee/initial-workforce-resource-journal.adapter"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"
type Context = Readonly<{ env: Readonly<{ DB: D1Database; COMPANY_TIME_ZONE?: string }> }>
export type CompanyBootstrapResult = Readonly<{
  employeeId: string
  organizationRevision: number
  replayed: boolean
}>
const receiptSchema = z.object({
  fingerprint: z.string(),
  employee_id: z.string(),
  organization_revision: z.number().int().positive(),
})

/** 空のCompanyの確認済み初期事実・公開履歴・再送結果を一つのtransactionで確定する。 */
export class CompanyBootstrapRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async initialize(
    command: CompanyBootstrapEntity,
  ): Promise<CompanyBootstrapResult | CompanyOperationError> {
    const canonical = CanonicalSystemJsonValue.create({
      ...command.props,
      recordedAt: null,
      observedOn: null,
    })
    if (canonical instanceof Error) return this.unavailable(canonical)
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return this.unavailable(digest)
    const fingerprint = digest.toString()
    try {
      const replay = await this.replay(command.props.commandId, fingerprint)
      if (replay !== null) return replay
      const applied = await this.apply(command, fingerprint, canonical.toString()).catch(
        (cause: unknown) => this.unavailable(cause),
      )
      if (!(applied instanceof Error)) return applied
      const raced = await this.replay(command.props.commandId, fingerprint)
      if (raced !== null) return raced
      if (await this.hasCompanyState(command)) return this.conflict()
      return applied instanceof CompanyConflictError || applied instanceof CompanyValidationError
        ? applied
        : this.unavailable(applied)
    } catch (cause) {
      return this.unavailable(cause)
    }
  }
  private async apply(command: CompanyBootstrapEntity, fingerprint: string, declaration: string) {
    const write = command.props
    if (write.timeZone !== this.c.env.COMPANY_TIME_ZONE || (await this.hasCompanyState(command)))
      return this.conflict()
    const rootId = await this.c.env.DB.prepare(
      "SELECT organization_unit_id FROM company_organization_unit_period_versions WHERE kind = 'COMPANY' LIMIT 1",
    ).first<string>("organization_unit_id")
    if (rootId === null) return this.conflict()
    const snapshots = new OrganizationResourceAdoptionSnapshotAdapter(this.c.env.DB)
    const snapshot = await snapshots.find(rootId)
    if (snapshot instanceof Error) return this.unavailable(snapshot)
    if (snapshot === null) return this.conflict()
    const employeeId = crypto.randomUUID()
    const employmentId = `employment:${crypto.randomUUID()}`
    const assignmentPeriodId = `bootstrap-assignment:${employeeId}`
    const companyResources = await new InitialCompanyResourceJournalAdapter(this.c.env.DB).prepare(
      command,
      snapshot,
      fingerprint,
      { employeeId, employmentId, assignmentPeriodId },
    )
    if (companyResources instanceof Error) return companyResources
    const actionId = `bootstrap:employee:${employeeId}`
    const organizationActionId = `bootstrap:organization:${employeeId}`
    const recordedAt = write.recordedAt
    const actionRecordedAt = Math.floor(recordedAt / 1_000)
    const summary = CanonicalSystemJsonValue.create({
      kind: "initial_state",
      eventOn: write.effectiveOn,
      department: { code: companyResources.root.code, name: write.organizationName },
      positionTitle: null,
      managerEmployeeCode: null,
      status: "active",
      employmentType: write.employmentType,
      employeeId,
      employmentId,
      actorAccountId: write.accountId,
      reason: write.reason,
    })
    if (summary instanceof Error) return summary
    const digest = await ProposalDigestValue.create(summary)
    if (digest instanceof Error) return digest
    const summaryJson = summary.toString()
    const initialResources = await new InitialWorkforceResourceJournalAdapter({
      env: { DB: this.c.env.DB },
      var: { database: drizzle(this.c.env.DB) },
    }).prepare({
      employeeId: restoreWorkforceId("employee", employeeId),
      employmentId: restoreWorkforceId("employment", employmentId),
      officialName: write.employeeName,
      employeeCode: write.employeeCode,
      email: null,
      phone: null,
      employmentType: write.employmentType,
      status: "active",
      effectiveOn: restoreCalendarDate(write.effectiveOn),
      occurredAt: new Date(write.recordedAt),
      actorAccountId: write.accountId,
      operationId: actionId,
      reason: write.reason,
      lifecycleRevision: 0,
      expectedOrganizationRevision: 1,
    })
    if (initialResources instanceof Error) return initialResources

    const statements: D1PreparedStatement[] = [
      snapshots.prepareGuard(snapshot),
      this.c.env.DB.prepare(`SELECT CASE WHEN
        NOT EXISTS (SELECT 1 FROM company_employees) AND
        EXISTS (SELECT 1 FROM company_organizations WHERE id = 'organization:default' AND revision = 0 AND name IN ('', ?1) AND representative_name IN ('', ?2)) AND
        (SELECT count(*) FROM company_organization_units) = 1 AND
        (SELECT count(*) FROM company_organization_unit_period_versions) = 1 AND
        NOT EXISTS (SELECT 1 FROM company_organization_assignment_period_versions) AND
        NOT EXISTS (SELECT 1 FROM company_organization_responsibility_period_versions)
        THEN 1 ELSE json_extract('', '$') END`).bind(
        write.organizationName,
        write.representativeName,
      ),
      ...companyResources.beginning,
      this.c.env.DB.prepare(
        `INSERT INTO company_employees
             (id, official_name, employee_code, email, phone, created_at, updated_at)
           VALUES (?1, ?2, ?3, NULL, NULL, ?4, ?4)`,
      ).bind(employeeId, write.employeeName, write.employeeCode, recordedAt),
      this.c.env.DB.prepare(
        `INSERT INTO company_employments
             (id, employee_id, contract_name, employment_type, hire_date, status,
              termination_date, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?6, ?4, 'ACTIVE', NULL, ?5, ?5)`,
      ).bind(
        employmentId,
        employeeId,
        write.employeeName,
        write.effectiveOn,
        recordedAt,
        write.employmentType,
      ),
      this.c.env.DB.prepare(
        `INSERT INTO company_account_employee_links (account_id, employee_id)
           VALUES (?1, ?2)`,
      ).bind(write.accountId, employeeId),
      this.c.env.DB.prepare(
        `INSERT INTO company_account_profiles
             (organization_id, account_id, display_name, created_at, updated_at)
           VALUES ('organization:default', ?1, ?2, ?3, ?3)`,
      ).bind(write.accountId, write.employeeName, recordedAt),
      this.c.env.DB.prepare(
        `INSERT INTO company_personnel_actions
             (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
              requested_by_employee_id, source_type, source_application_id,
              corrects_action_id, operation_id, payload_fingerprint, summary_json)
           VALUES (?1, ?2, 'initial_state', ?3, ?4, ?5, NULL, 'system', NULL,
                   NULL, ?1, ?6, ?7)`,
      ).bind(
        actionId,
        employeeId,
        write.effectiveOn,
        actionRecordedAt,
        write.accountId,
        digest.toString(),
        summaryJson,
      ),
      this.c.env.DB.prepare(
        `INSERT INTO company_employment_period_versions
             (period_id, revision, employee_id, starts_on, ends_on, is_void,
              recorded_by_action_id, recorded_at)
           VALUES (?1, 1, ?2, ?3, NULL, 0, ?4, ?5)`,
      ).bind(employmentId, employeeId, write.effectiveOn, actionId, actionRecordedAt),
      this.c.env.DB.prepare(
        `INSERT INTO company_employee_status_period_versions
             (period_id, revision, employment_period_id, employee_id, status,
              starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
           VALUES (?1, 1, ?2, ?3, 'active', ?4, NULL, 0, ?5, ?6)`,
      ).bind(
        `bootstrap-status:${employeeId}`,
        employmentId,
        employeeId,
        write.effectiveOn,
        actionId,
        actionRecordedAt,
      ),
      this.c.env.DB.prepare(
        `INSERT INTO company_employee_lifecycle_revisions
             (employee_id, revision, updated_at)
           VALUES (?1, 0, ?2)`,
      ).bind(employeeId, actionRecordedAt),
      ...initialResources,
      this.c.env.DB.prepare(
        `INSERT INTO company_organization_change_operations
             (id, expected_revision, change_count, applied_count, resulting_revision,
              status, recorded_at, request_fingerprint, actor_account_id, reason,
              evidence_references_json)
           SELECT ?1, revision, ?6, 0, revision + ?6, 'PENDING', ?2, ?3, ?4, ?5, '[]'
           FROM company_organization_lifecycle_states WHERE id = 1`,
      ).bind(
        organizationActionId,
        recordedAt,
        fingerprint,
        write.accountId,
        write.reason,
        3 + write.initialResponsibilities.length,
      ),
      this.c.env.DB.prepare(`INSERT INTO company_organization_unit_period_versions
        (period_id, revision, organization_unit_id, code, official_name, kind, parent_organization_unit_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
        VALUES (?1, 2, ?2, ?3, ?4, 'COMPANY', NULL, ?5, ?8, ?9, ?6, ?7)`).bind(
        companyResources.root.periodId,
        companyResources.root.organizationUnitId,
        companyResources.root.code,
        companyResources.root.officialName,
        companyResources.root.startsOn,
        organizationActionId,
        recordedAt,
        companyResources.closeOriginal ? write.observedOn : null,
        companyResources.closeOriginal ? 0 : 1,
      ),
      this.c.env.DB.prepare(`INSERT INTO company_organization_unit_period_versions
        (period_id, revision, organization_unit_id, code, official_name, kind, parent_organization_unit_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
        VALUES (?1, 1, ?2, ?3, ?4, 'COMPANY', NULL, ?5, NULL, 0, ?6, ?7)`).bind(
        companyResources.currentPeriodId,
        companyResources.root.organizationUnitId,
        companyResources.root.code,
        write.organizationName,
        write.observedOn,
        organizationActionId,
        recordedAt,
      ),
      this.c.env.DB.prepare(
        `INSERT INTO company_organization_assignment_period_versions
             (period_id, revision, employment_id, employee_id, organization_unit_id,
              assignment_type, position_title, manager_employee_id, starts_on, ends_on,
              is_void, recorded_by_action_id, recorded_at)
           VALUES (?1, 1, ?2, ?3, ?7, 'PRIMARY', NULL, NULL, ?4,
                   NULL, 0, ?5, ?6)`,
      ).bind(
        assignmentPeriodId,
        employmentId,
        employeeId,
        write.effectiveOn,
        organizationActionId,
        recordedAt,
        companyResources.root.organizationUnitId,
      ),
      ...write.initialResponsibilities.map((responsibilityType) =>
        this.c.env.DB.prepare(`INSERT INTO company_organization_responsibility_period_versions
        (period_id, revision, employment_id, employee_id, organization_unit_id, responsibility_type, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
        VALUES (?1, 1, ?2, ?3, ?4, ?5, ?6, NULL, 0, ?7, ?8)`).bind(
          `bootstrap-responsibility:${responsibilityType.toLowerCase()}:${employeeId}`,
          employmentId,
          employeeId,
          companyResources.root.organizationUnitId,
          responsibilityType,
          write.observedOn,
          organizationActionId,
          recordedAt,
        ),
      ),
      ...companyResources.completion,
      this.c.env.DB.prepare(
        `UPDATE company_organization_change_operations
           SET status = 'COMPLETED'
           WHERE id = ?1 AND status = 'PENDING'`,
      ).bind(organizationActionId),
      this.c.env.DB.prepare(`INSERT INTO company_bootstrap_receipts
        (command_id, organization_id, actor_account_id, fingerprint, employee_id, organization_revision, declaration_json, source_json, recorded_at)
        VALUES (?1, 'organization:default', ?2, ?3, ?4, 3, ?5, ?6, ?7)`).bind(
        write.commandId,
        write.accountId,
        fingerprint,
        employeeId,
        declaration,
        snapshot.props.sourceJson,
        recordedAt,
      ),
    ]

    const results = await this.c.env.DB.batch(statements)
    if (results.length !== statements.length || results.some((result) => !result.success))
      return this.unavailable(new Error("Company bootstrap batch did not succeed"))
    return { employeeId, organizationRevision: 3, replayed: false }
  }
  private async hasCompanyState(command: CompanyBootstrapEntity): Promise<boolean> {
    return (
      (await this.c.env.DB.prepare(`SELECT 1 FROM company_employees
      UNION ALL SELECT 1 FROM company_organizations WHERE id = 'organization:default' AND (revision > 0 OR name NOT IN ('', ?1) OR representative_name NOT IN ('', ?2))
      UNION ALL SELECT 1 WHERE (SELECT count(*) FROM company_organization_units) <> 1
        OR (SELECT count(*) FROM company_organization_unit_period_versions) <> 1
        OR EXISTS (SELECT 1 FROM company_organization_assignment_period_versions)
        OR EXISTS (SELECT 1 FROM company_organization_responsibility_period_versions)
      LIMIT 1`)
        .bind(command.props.organizationName, command.props.representativeName)
        .first()) !== null
    )
  }
  private async replay(
    commandId: string,
    fingerprint: string,
  ): Promise<CompanyBootstrapResult | CompanyConflictError | null> {
    const row = await this.c.env.DB.prepare(
      "SELECT fingerprint, employee_id, organization_revision FROM company_bootstrap_receipts WHERE command_id = ?1",
    )
      .bind(commandId)
      .first()
    if (row === null) return null
    const receipt = receiptSchema.parse(row)
    if (receipt.fingerprint !== fingerprint) return this.conflict()
    return {
      employeeId: receipt.employee_id,
      organizationRevision: receipt.organization_revision,
      replayed: true,
    }
  }
  private conflict(): CompanyConflictError {
    return new CompanyConflictError(
      "初期化の内容または会社情報を確認してください",
      "company_bootstrap_conflict",
    )
  }
  private unavailable(cause: unknown): CompanyUnavailableError {
    return new CompanyUnavailableError(
      "会社の初期化を保存できません",
      "company_bootstrap_unavailable",
      { cause },
    )
  }
}

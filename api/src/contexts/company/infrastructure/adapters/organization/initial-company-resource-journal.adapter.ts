import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import type { CompanyBootstrapEntity } from "@/contexts/company/domain/entities/company-bootstrap.entity"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { OrganizationResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/organization-resource-adoption-snapshot.value"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import { CompanyConflictError, CompanyValidationError } from "@/contexts/company/domain/errors"
import { drizzle } from "drizzle-orm/d1"
type Context = D1Database

/** 初期ルートの履歴を保全し、確認した会社名と会社文脈を同じ初期化へ保存する。 */
export class InitialCompanyResourceJournalAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async prepare(
    command: CompanyBootstrapEntity,
    snapshot: OrganizationResourceAdoptionSnapshotValue,
    fingerprint: string,
    workforce: Readonly<{ employeeId: string; employmentId: string; assignmentPeriodId: string }>,
  ) {
    const source = snapshot.props.value
    const root = source.periods[0]
    if (
      source.organizationRevision !== 0 ||
      source.lifecycleRevision !== 1 ||
      source.bindingOrganizationId !== null ||
      source.pendingOperations !== 0 ||
      source.periods.length !== 1 ||
      root === undefined ||
      root.revision !== 1 ||
      root.kind !== "COMPANY" ||
      root.parentOrganizationUnitId !== null ||
      root.isVoid !== 0 ||
      root.endsOn !== null
    )
      return new CompanyConflictError(
        "既存の会社情報は初期化で上書きできません",
        "company_bootstrap_conflict",
      )
    const write = command.props
    const originalRoot: CompanyResourceProps = {
      organizationId: "organization:default",
      type: "organization-unit",
      id: root.periodId,
      revision: root.revision,
      state: "active",
      effectiveFrom: restoreCalendarDate(root.startsOn),
      effectiveTo: root.endsOn,
      attributes: {
        organizationUnitId: root.organizationUnitId,
        code: root.code,
        officialName: root.officialName,
        kind: root.kind,
        parentOrganizationUnitId: root.parentOrganizationUnitId,
      },
    }
    const initial = CompanyResourceChangeEntity.create({
      commandId: `bootstrap-root:${write.commandId}`,
      expectedRevision: 0,
      actorAccountId: write.accountId,
      reason: write.reason,
      recordedAt: write.recordedAt,
      resources: [originalRoot],
    })
    if (initial instanceof Error) return initial
    if (write.effectiveOn < root.startsOn)
      return new CompanyValidationError(
        "会社の組織履歴より前の在籍には履歴確認が必要です",
        "invalid_company_bootstrap_input",
      )
    const currentPeriodId = `bootstrap-root:${fingerprint}`
    const closeOriginal = root.startsOn < write.observedOn
    const closedRoot: CompanyResourceProps = {
      ...originalRoot,
      revision: 2,
      state: closeOriginal ? "active" : "void",
      effectiveTo: closeOriginal ? restoreCalendarDate(write.observedOn) : null,
    }
    const currentRoot: CompanyResourceProps = {
      ...originalRoot,
      id: currentPeriodId,
      revision: 1,
      effectiveFrom: restoreCalendarDate(write.observedOn),
      attributes: { ...originalRoot.attributes, officialName: write.organizationName },
    }
    const final = CompanyResourceChangeEntity.create({
      commandId: `bootstrap-company:${write.commandId}`,
      expectedRevision: 2,
      actorAccountId: write.accountId,
      reason: write.reason,
      recordedAt: write.recordedAt,
      resources: [
        closedRoot,
        currentRoot,
        {
          organizationId: "organization:default",
          type: "account-employee-link",
          id: `account-link:${workforce.employeeId}`,
          revision: 1,
          state: "active",
          effectiveFrom: restoreCalendarDate(write.observedOn),
          effectiveTo: null,
          attributes: { accountId: write.accountId, employeeId: workforce.employeeId },
        },
        {
          organizationId: "organization:default",
          type: "assignment",
          id: `assignment:${workforce.assignmentPeriodId}`,
          revision: 1,
          state: "active",
          effectiveFrom: restoreCalendarDate(write.effectiveOn),
          effectiveTo: null,
          attributes: {
            employeeId: workforce.employeeId,
            employmentId: workforce.employmentId,
            organizationUnitId: root.organizationUnitId,
            assignmentType: "PRIMARY",
            positionTitle: null,
          },
        },
        {
          organizationId: "organization:default",
          type: "company-profile",
          id: "company-profile:default",
          revision: 1,
          state: "active",
          effectiveFrom: restoreCalendarDate(write.observedOn),
          effectiveTo: null,
          attributes: {
            displayName: write.organizationName,
            representativeName: write.representativeName,
            locale: write.locale,
            timeZone: write.timeZone,
            fiscalYearStartMonth: write.fiscalYearStartMonth,
          },
        },
      ],
    })
    if (final instanceof Error) return final
    const journal = new CompanyResourceJournalAdapter({ database: drizzle(this.c), d1: this.c })
    const beginning = await journal.prepare(initial)
    if (beginning instanceof Error) return beginning
    const completion = await journal.prepare(final)
    if (completion instanceof Error) return completion
    return {
      root,
      currentPeriodId,
      closeOriginal,
      beginning: [
        ...beginning.statements,
        this.c
          .prepare(
            "INSERT INTO company_organization_resource_bindings (organization_unit_id, organization_id, recorded_at) VALUES (?1, 'organization:default', ?2)",
          )
          .bind(root.organizationUnitId, write.recordedAt),
        beginning.commit,
      ],
      completion: [
        ...completion.statements,
        this.c
          .prepare(`INSERT INTO company_assignment_resource_bindings
          (resource_id, organization_id, employee_id, resource_revision, recorded_at)
          VALUES (?1, 'organization:default', ?2, 1, ?3)`)
          .bind(
            `assignment:${workforce.assignmentPeriodId}`,
            workforce.employeeId,
            write.recordedAt,
          ),
        this.c
          .prepare(`INSERT INTO company_assignment_period_bindings
          (period_id, resource_id, period_revision, source_revision) VALUES (?1, ?2, 1, 1)`)
          .bind(workforce.assignmentPeriodId, `assignment:${workforce.assignmentPeriodId}`),
        completion.commit,
      ],
    }
  }
}

import { CompanyResponsibilityJournalAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-responsibility-journal.adapter"
import type { OrgResponsibilityPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type { OrgResponsibilityPeriod as LifecycleResponsibilityPeriod } from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { toWorkforceResponsibilityType } from "@/contexts/company/domain/definitions/to-workforce-responsibility-type.definition"
import type { PersonnelActionPersistenceProps } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/lib/personnel-action-persistence-props"
import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyEmploymentDependentChangeValue } from "@/contexts/company/domain/values/company-employment-dependent-change.value"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyEmploymentJournalAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/company-employment-journal.adapter"
import { CompanyAssignmentJournalAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/company-assignment-journal.adapter"
import { CompanyPersonnelReportingJournalAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/company-personnel-reporting-journal.adapter"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import {
  CompanyConflictError,
  CompanyResourceValidationError,
  CompanyOperationError,
  CompanyUnexpectedError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { drizzle } from "drizzle-orm/d1"
import type { PersonnelActionSummary } from "@/contexts/company/domain/definitions/personnel-action-summary.definition"

type Context = D1Database

/** 同じ発令の雇用と所属を、参照先と版の順序を保って公開履歴へ確定する。 */
export class CompanyPersonnelResourceJournalAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(props: PersonnelActionPersistenceProps): Promise<
    | Readonly<{
        statements: ReadonlyArray<D1PreparedStatement>
        assignmentPeriodIds: ReadonlySet<string>
        summary: PersonnelActionSummary
      }>
    | CompanyOperationError
  > {
    try {
      const employment = await new CompanyEmploymentJournalAdapter(this.c).prepare(props)
      if (employment instanceof CompanyOperationError) return employment
      const assignment = await new CompanyAssignmentJournalAdapter(this.c).prepare(props)
      if (assignment instanceof CompanyOperationError) return assignment
      const reporting = await new CompanyPersonnelReportingJournalAdapter(this.c).prepare(
        props,
        assignment.periodIds,
        employment.organizationRevision,
      )
      if (reporting instanceof CompanyOperationError) return reporting
      const responsibilities = await new CompanyResponsibilityJournalAdapter(this.c).prepare({
        employeeId: props.action.employeeId,
        recordedAt: props.action.recordedAt * 1000,
        correctsActionId: props.action.correctsActionId,
        connectNew: employment.organizationRevision !== null,
        newOrganizationUnitIds: new Set(),
        changes: props.projection.mutations
          .filter((mutation) => mutation.periodType === "responsibility")
          .map((mutation) => ({
            before: mutation.before === null ? null : this.responsibilityPeriod(mutation.before),
            after: this.responsibilityPeriod(mutation.after),
          })),
      })
      if (responsibilities instanceof CompanyOperationError) return responsibilities
      if (responsibilities instanceof CompanyResourceValidationError)
        return new CompanyValidationError(
          "公開責務の履歴を準備できません",
          "lifecycle_projection_mismatch",
          { cause: responsibilities },
        )
      if (responsibilities instanceof Error)
        return new CompanyUnexpectedError("公開責務の履歴を参照できません", {
          cause: responsibilities,
        })
      const authority = await this.prepareAuthority(
        props,
        employment.organizationRevision,
        responsibilities.resourceIds,
      )
      if (authority instanceof CompanyOperationError) return authority
      const resources = [
        ...employment.resources,
        ...assignment.resources,
        ...reporting.resources,
        ...authority,
        ...responsibilities.resources,
      ]
      if (resources.length !== 0 && employment.organizationRevision === null)
        return new CompanyUnexpectedError("公開Companyの従業員対応がありません")
      const statements = [...employment.statements]
      if (resources.length > 0) {
        const change = CompanyResourceChangeEntity.createHistoryBatch({
          commandId: `lifecycle:${props.action.id}:0`,
          expectedRevision: employment.organizationRevision ?? 0,
          actorAccountId: props.command.session.accountId,
          reason: `personnel_action:${props.action.kind}:${props.action.id}`,
          recordedAt: props.action.recordedAt * 1000,
          resources,
        })
        if (change instanceof Error)
          return new CompanyUnexpectedError("人事発令の公開commandを作成できません", {
            cause: change,
          })
        const journal = await new CompanyResourceJournalAdapter({
          d1: this.c,
          database: drizzle(this.c),
        }).prepare(change)
        if (journal instanceof Error)
          return new CompanyUnexpectedError("人事発令の公開履歴を準備できません", {
            cause: journal,
          })
        statements.push(...journal.statements, journal.commit)
      }
      return {
        statements: [
          ...statements,
          ...responsibilities.bindings,
          ...employment.bindings,
          ...assignment.bindings,
          ...reporting.bindings,
        ],
        assignmentPeriodIds: assignment.periodIds,
        summary: reporting.summary,
      }
    } catch (cause) {
      return new CompanyUnexpectedError("人事発令の公開履歴を準備できません", { cause })
    }
  }

  private async prepareAuthority(
    props: PersonnelActionPersistenceProps,
    organizationRevision: number | null,
    connectedResponsibilities: ReadonlySet<string>,
  ): Promise<ReadonlyArray<CompanyResourceEntity> | CompanyOperationError> {
    if (
      organizationRevision === null ||
      !props.projection.mutations.some(
        (mutation) => mutation.periodType === "employment" || mutation.periodType === "assignment",
      )
    )
      return []
    const history = await new D1CompanyResourceRepository(this.c).findEmploymentDependentHistory(
      "organization:default",
      organizationRevision,
    )
    if (history instanceof Error)
      return new CompanyUnexpectedError("等級割当・任用・決裁資格の履歴を参照できません", {
        cause: history,
      })
    const resources: CompanyResourceEntity[] = []
    const identities = new Set(
      history
        .filter(
          (resource) =>
            resource.type !== "responsibility-assignment" ||
            !connectedResponsibilities.has(resource.id),
        )
        .filter(
          (resource) =>
            resource.readText("employeeId") === props.action.employeeId ||
            (resource.type === "responsibility-assignment" &&
              resource.readText("holderType") === "employee" &&
              resource.readText("holderId") === props.action.employeeId),
        )
        .map((resource) => `${resource.type}:${resource.id}`),
    )
    for (const identity of identities) {
      const versions = history.filter((resource) => `${resource.type}:${resource.id}` === identity)
      const first = versions[0]
      if (first === undefined) return new CompanyUnexpectedError("雇用に付随する履歴がありません")
      const prefix = `lifecycle:${props.action.correctsActionId}:`
      const original =
        props.action.correctsActionId === null
          ? null
          : await this.c
              .prepare(`
        SELECT min(revision) AS first_revision, max(revision) AS last_revision FROM company_resource_revisions
        WHERE organization_id = 'organization:default' AND resource_type = ?1 AND resource_id = ?2
          AND substr(command_id, 1, length(?3)) = ?3`)
              .bind(first.type, first.id, prefix)
              .first<{ first_revision: number | null; last_revision: number | null }>()
      const firstRevision = original?.first_revision ?? null
      const lastRevision = original?.last_revision ?? null
      if (lastRevision !== null && versions.some((resource) => resource.revision > lastRevision))
        return new CompanyConflictError(
          "訂正対象の等級割当・任用・決裁資格は後続の変更を受けています",
          "personnel_action_stale",
        )
      const basis =
        firstRevision === null
          ? versions
          : versions.filter((resource) => resource.revision < firstRevision)
      const change = CompanyEmploymentDependentChangeValue.create({
        employeeId: props.action.employeeId,
        history: versions,
        basis,
        schedule: props.projection.schedule,
      })
      if (change instanceof Error)
        return new CompanyValidationError(
          "雇用変更後の等級割当・任用・決裁資格を準備できません",
          "lifecycle_projection_mismatch",
          { cause: change },
        )
      resources.push(...change.resources)
    }
    return resources
  }
  private responsibilityPeriod(period: LifecycleResponsibilityPeriod): OrgResponsibilityPeriod {
    return {
      periodId: restoreWorkforceId("period", period.periodId),
      revision: period.revision,
      employeeId: period.employeeId,
      employmentId: period.employmentId,
      organizationUnitId: period.organizationUnitId,
      responsibilityType: toWorkforceResponsibilityType(period.responsibilityType),
      startsOn: restoreCalendarDate(period.startsOn),
      endsOn: period.endsOn === null ? null : restoreCalendarDate(period.endsOn),
      isVoid: period.isVoid,
      recordedByActionId: restoreWorkforceId("personnel_action", period.recordedByActionId),
      recordedAt: period.recordedAt * 1000,
    }
  }
}

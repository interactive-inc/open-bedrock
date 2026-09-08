import type { PersonnelActionPersistenceProps } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/lib/personnel-action-persistence-props"
import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyEmploymentAuthorityChangeValue } from "@/contexts/company/domain/values/company-employment-authority-change.value"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyEmploymentJournalAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/company-employment-journal.adapter"
import { CompanyAssignmentJournalAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/company-assignment-journal.adapter"
import { CompanyPersonnelReportingJournalAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/company-personnel-reporting-journal.adapter"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import {
  CompanyConflictError,
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
      const authority = await this.prepareAuthority(props, employment.organizationRevision)
      if (authority instanceof CompanyOperationError) return authority
      const groups = new Map<string, CompanyResourceEntity[]>()
      for (const resource of [
        ...employment.resources,
        ...assignment.resources,
        ...reporting.resources,
        ...authority,
      ]) {
        const key = `${resource.type}:${resource.id}`
        const versions = groups.get(key) ?? []
        versions.push(resource)
        groups.set(key, versions)
      }
      if (groups.size !== 0 && employment.organizationRevision === null)
        return new CompanyUnexpectedError("公開Companyの従業員対応がありません")
      const statements = [...employment.statements]
      let commandIndex = 0
      while (groups.size > 0) {
        const resources: CompanyResourceEntity[] = []
        for (const [key, versions] of groups) {
          if (resources.length === 100) break
          const resource = versions.shift()
          if (resource !== undefined) resources.push(resource)
          if (versions.length === 0) groups.delete(key)
        }
        const change = CompanyResourceChangeEntity.create({
          commandId: `lifecycle:${props.action.id}:${commandIndex}`,
          expectedRevision: (employment.organizationRevision ?? 0) + commandIndex,
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
        commandIndex += 1
      }
      return {
        statements: [
          ...statements,
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
  ): Promise<ReadonlyArray<CompanyResourceEntity> | CompanyOperationError> {
    if (
      organizationRevision === null ||
      !props.projection.mutations.some(
        (mutation) => mutation.periodType === "employment" || mutation.periodType === "assignment",
      )
    )
      return []
    const history = await new D1CompanyResourceRepository(this.c).findEmploymentAuthorityHistory(
      "organization:default",
      organizationRevision,
    )
    if (history instanceof Error)
      return new CompanyUnexpectedError("任用・決裁資格の履歴を参照できません", { cause: history })
    const resources: CompanyResourceEntity[] = []
    const identities = new Set(
      history
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
      if (first === undefined) return new CompanyUnexpectedError("任用の履歴がありません")
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
          "訂正対象の任用・決裁資格は後続の変更を受けています",
          "personnel_action_stale",
        )
      const basis =
        firstRevision === null
          ? versions
          : versions.filter((resource) => resource.revision < firstRevision)
      const change = CompanyEmploymentAuthorityChangeValue.create({
        employeeId: props.action.employeeId,
        history: versions,
        basis,
        schedule: props.projection.schedule,
      })
      if (change instanceof Error)
        return new CompanyValidationError(
          "雇用変更後の任用・決裁資格を準備できません",
          "lifecycle_projection_mismatch",
          { cause: change },
        )
      resources.push(...change.resources)
    }
    return resources
  }
}

import type { PersonnelActionPersistenceProps } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action-persistence.adapter"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyEmploymentJournalChangeValue } from "@/contexts/company/domain/values/company-employment-journal-change.value"
import {
  CompanyConflictError,
  CompanyOperationError,
  CompanyUnexpectedError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import { CompanyEmploymentResourceHistoryAdapter } from "@/contexts/company/infrastructure/adapters/employee/company-employment-resource-history.adapter"
import { AbortWhenPreviousStatementChangedNoRowsAdapter } from "@/contexts/company/infrastructure/adapters/database/abort-when-previous-statement-changed-no-rows.adapter"
import { z } from "zod"
import { InitialWorkforceResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/employee/initial-workforce-resource-journal.adapter"
import { drizzle } from "drizzle-orm/d1"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"

const bindingRow = z.object({
  organization_id: z.string(),
  resource_revision: z.number().int().positive(),
  lifecycle_revision: z.number().int().nonnegative(),
})
type Context = D1Database

/** 人事発令で更新する期間を公開履歴へ反映し、同じEmployeeの版を一緒に進める。 */
export class CompanyEmploymentJournalAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    props: PersonnelActionPersistenceProps,
  ): Promise<ReadonlyArray<D1PreparedStatement> | CompanyOperationError> {
    try {
      const snapshot = await this.c.batch([
        this.c
          .prepare(`SELECT organization_id, resource_revision, lifecycle_revision
          FROM company_workforce_resource_bindings WHERE resource_type = 'employee' AND resource_id = ?1`)
          .bind(props.action.employeeId),
        this.c
          .prepare(`SELECT organization.revision FROM company_organizations AS organization
          JOIN company_workforce_resource_bindings AS binding ON binding.organization_id = organization.id
          WHERE binding.resource_type = 'employee' AND binding.resource_id = ?1`)
          .bind(props.action.employeeId),
        this.c
          .prepare(`SELECT resource_id, organization_id, resource_revision, lifecycle_revision
          FROM company_workforce_resource_bindings WHERE resource_type = 'employment' AND employee_id = ?1`)
          .bind(props.action.employeeId),
      ])
      if (snapshot.length !== 3 || snapshot.some((result) => !result.success))
        return new CompanyUnexpectedError("公開雇用の版を参照できません")
      const employee = bindingRow.nullable().safeParse(snapshot[0]?.results[0] ?? null)
      const revision = z
        .object({ revision: z.number().int().nonnegative() })
        .nullable()
        .safeParse(snapshot[1]?.results[0] ?? null)
      const employments = z
        .array(bindingRow.extend({ resource_id: z.string() }))
        .safeParse(snapshot[2]?.results)
      if (!employee.success || !revision.success || !employments.success)
        return new CompanyUnexpectedError("公開雇用の所有関係が不正です")
      if (employee.data === null) {
        if (employments.data.length > 0)
          return new CompanyUnexpectedError("公開雇用のEmployee対応が欠けています")
        if (props.prospectiveEmployee !== undefined) {
          if (props.projection.newEmploymentType === null)
            return new CompanyUnexpectedError("新規雇用の区分がありません")
          const period = props.projection.schedule.employments[0]
          if (period === undefined || props.projection.schedule.employments.length !== 1)
            return new CompanyUnexpectedError("新規従業員の雇用期間が不正です")
          const initial = await new InitialWorkforceResourceJournalAdapter({
            env: { DB: this.c },
            var: { database: drizzle(this.c) },
          }).prepare({
            employeeId: props.action.employeeId,
            employmentId: period.employmentId,
            officialName: props.prospectiveEmployee.name,
            employeeCode: props.prospectiveEmployee.code,
            email: props.prospectiveEmployee.email ?? null,
            phone: null,
            employmentType: props.projection.newEmploymentType,
            status: "active",
            effectiveOn: restoreCalendarDate(period.startsOn),
            occurredAt: new Date(props.action.recordedAt * 1000),
            actorAccountId: props.command.session.accountId,
            operationId: props.action.id,
            reason: `personnel_action:${props.action.kind}:${props.action.id}`,
            lifecycleRevision: props.revisions.employeeRevision + 1,
          })
          return initial instanceof Error
            ? new CompanyUnexpectedError("公開Companyの初期記録を準備できません", {
                cause: initial,
              })
            : initial
        }
        return []
      }
      if (
        revision.data === null ||
        employee.data.organization_id !== "organization:default" ||
        employee.data.lifecycle_revision !== props.revisions.employeeRevision ||
        employments.data.some(
          (binding) =>
            binding.organization_id !== employee.data?.organization_id ||
            binding.lifecycle_revision !== props.revisions.employeeRevision,
        )
      )
        return new CompanyConflictError(
          "公開雇用と人事発令の版が一致しません",
          "personnel_action_stale",
        )
      const organizationId = employee.data.organization_id
      let organizationRevision = revision.data.revision
      let commandIndex = 0
      const statements: D1PreparedStatement[] = [
        this.c
          .prepare(`UPDATE company_workforce_resource_bindings SET lifecycle_revision = lifecycle_revision
          WHERE resource_type = 'employee' AND resource_id = ?1 AND resource_revision = ?2 AND lifecycle_revision = ?3`)
          .bind(
            props.action.employeeId,
            employee.data.resource_revision,
            props.revisions.employeeRevision,
          ),
        new AbortWhenPreviousStatementChangedNoRowsAdapter(
          this.c,
        ).abortWhenPreviousStatementChangedNoRows(),
      ]
      const affected = new Set(
        props.projection.mutations.flatMap((mutation) =>
          mutation.periodType === "employment"
            ? [mutation.after.employmentId]
            : mutation.periodType === "status"
              ? [mutation.after.employmentPeriodId]
              : [],
        ),
      )
      for (const employmentId of affected) {
        const period = [
          ...props.projection.schedule.employments,
          ...props.projection.mutations.flatMap((mutation) =>
            mutation.periodType === "employment" ? [mutation.after] : [],
          ),
        ]
          .filter((candidate) => candidate.employmentId === employmentId)
          .toSorted((left, right) => right.revision - left.revision)[0]
        if (period === undefined) return new CompanyUnexpectedError("変更後の雇用期間がありません")
        const history = await new CompanyEmploymentResourceHistoryAdapter(this.c).read({
          organizationId,
          id: employmentId,
        })
        if (history instanceof Error)
          return new CompanyUnexpectedError("公開雇用の履歴を参照できません", { cause: history })
        const binding = employments.data.find((candidate) => candidate.resource_id === employmentId)
        if (
          (binding === undefined && history.length !== 0) ||
          (binding !== undefined && binding.resource_revision !== history.at(-1)?.revision)
        )
          return new CompanyConflictError(
            "公開雇用の版が更新されています",
            "personnel_action_stale",
          )
        if (
          binding === undefined &&
          props.scheduleBefore.employments.some(
            (previous) => previous.employmentId === employmentId,
          )
        )
          return new CompanyValidationError(
            "既存雇用と公開履歴の対応がありません",
            "lifecycle_projection_mismatch",
          )
        const changes = CompanyEmploymentJournalChangeValue.create({
          organizationId,
          history,
          employment: period,
          statuses: props.projection.schedule.statuses,
          // 既存契約の属性は履歴から保全し、新規契約だけ確認済みの区分を使う。
          initialAttributes: {
            employeeId: props.action.employeeId,
            ...(props.projection.newEmploymentType === null
              ? {}
              : { employmentType: props.projection.newEmploymentType }),
            status: "ACTIVE",
          },
        })
        if (changes instanceof Error)
          return new CompanyValidationError(
            "人事発令を公開雇用の履歴へ変換できません",
            "lifecycle_projection_mismatch",
            { cause: changes },
          )
        for (const resource of changes.resources) {
          const change = CompanyResourceChangeEntity.create({
            commandId: `lifecycle:${props.action.id}:${commandIndex++}`,
            expectedRevision: organizationRevision++,
            actorAccountId: props.command.session.accountId,
            reason: `personnel_action:${props.action.kind}:${props.action.id}`,
            recordedAt: props.action.recordedAt * 1000,
            resources: [resource],
          })
          if (change instanceof Error)
            return new CompanyUnexpectedError("公開雇用のcommandを作成できません", {
              cause: change,
            })
          const journal = await new CompanyResourceJournalAdapter({
            database: drizzle(this.c),
            d1: this.c,
          }).prepare(change)
          if (journal instanceof Error)
            return new CompanyUnexpectedError("公開雇用の履歴を準備できません", { cause: journal })
          statements.push(...journal.statements, journal.commit)
        }
        const resourceRevision = changes.resources.at(-1)?.revision ?? binding?.resource_revision
        if (resourceRevision === undefined)
          return new CompanyUnexpectedError("公開雇用の結果revisionがありません")
        statements.push(
          this.c
            .prepare(`INSERT INTO company_workforce_resource_bindings
          (resource_type, resource_id, organization_id, employee_id, resource_revision, lifecycle_revision, last_action_id)
          VALUES ('employment', ?1, ?2, ?3, ?4, ?5, ?6)
          ON CONFLICT (resource_type, resource_id) DO UPDATE SET resource_revision = excluded.resource_revision,
            lifecycle_revision = excluded.lifecycle_revision, last_action_id = excluded.last_action_id
          WHERE company_workforce_resource_bindings.organization_id = excluded.organization_id
            AND company_workforce_resource_bindings.employee_id = excluded.employee_id`)
            .bind(
              employmentId,
              organizationId,
              props.action.employeeId,
              resourceRevision,
              props.revisions.employeeRevision + 1,
              props.action.id,
            ),
        )
        statements.push(
          new AbortWhenPreviousStatementChangedNoRowsAdapter(
            this.c,
          ).abortWhenPreviousStatementChangedNoRows(),
        )
      }
      statements.push(
        this.c
          .prepare(`UPDATE company_workforce_resource_bindings SET lifecycle_revision = ?1
        WHERE employee_id = ?2 AND organization_id = ?3`)
          .bind(props.revisions.employeeRevision + 1, props.action.employeeId, organizationId),
      )
      return statements
    } catch (cause) {
      return new CompanyUnexpectedError("公開雇用の履歴を準備できません", { cause })
    }
  }
}

import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { CompanyAccountEmployeeLinksReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-account-employee-links-read.adapter"
import type {
  WorkforceSnapshotReadPort,
  WorkforceSnapshotReadResult,
} from "@/contexts/company/domain/definitions/organization-change.definition"
import { toWorkforceLifecycleSchedules } from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import { EmployeeLifecycleAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle.adapter"
import {
  attachOrganizationPeriods,
  type OrgAssignmentProjectionRow,
  type OrgResponsibilityProjectionRow,
} from "@/contexts/company/lib/workforce/organization-period-row.adapter"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { ReadWorkforceBaselineStatesAdapter } from "@/contexts/company/infrastructure/adapters/workforce/read-workforce-baseline-states.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

type EmployeeRow = Readonly<{
  id: EmployeeId
  employeeCode: string | null
  officialName: string | null
  email: string | null
  phone: string | null
}>

type AssignmentRow = Omit<OrgAssignmentProjectionRow, "isVoid"> & Readonly<{ isVoid: number }>
type ResponsibilityRow = Omit<OrgResponsibilityProjectionRow, "isVoid"> &
  Readonly<{ isVoid: number }>

function emptySchedule(employeeId: EmployeeId): WorkforceLifecycleSchedule {
  return { employeeId, employments: [], statuses: [], assignments: [], responsibilities: [] }
}
type Context = CompanyContext

/** 既存Employee・lifecycle保存を共通の全社Workforce snapshotへ接続する。 */
export class OrganizationWorkforceSnapshotAdapter implements WorkforceSnapshotReadPort {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /**
   * 従業員の氏名、従業員 code、連絡先を、従業員ごとの正本から読む。
   *
   * 公開履歴へ接続済みの従業員は、公開 Person と従業員の resource から読む。snapshot は退職者と入社前の
   * 従業員も含むので、会社営業日に有効な版を優先し、無ければ最も新しい版を使う。最も新しい版が取消なら
   * 空のまま返し、正規の形式の検証で拒否させる。表の列で補わない。
   *
   * 公開履歴へ未接続の従業員は、接続されるまで従業員の表が唯一の原記録なので、表の列を読む。
   */
  private async readEmployees(asOf?: CalendarDate): Promise<D1Result<EmployeeRow>> {
    const effectiveOn =
      asOf ??
      resolveCompanyBusinessDate({
        now: this.c.env.NOW ?? new Date().toISOString(),
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })
    if (effectiveOn instanceof Error) throw effectiveOn
    return this.c.env.DB.prepare(
      `WITH ranked_profiles AS (
         SELECT resource.*, row_number() OVER (
           PARTITION BY organization_id, resource_type, resource_id
           ORDER BY CASE WHEN effective_from <= ?1 AND (effective_to IS NULL OR ?1 < effective_to)
               THEN 0 ELSE 1 END,
             effective_from DESC, revision DESC) AS profile_rank
         FROM company_resource_revisions AS resource
         WHERE resource_type IN ('person', 'employee')
       ),
       profiles AS (SELECT * FROM ranked_profiles WHERE profile_rank = 1 AND state = 'active'),
       connected_employees AS (
         SELECT employee_id, organization_id, resource_id FROM company_workforce_resource_bindings
         WHERE resource_type = 'employee'
       ),
       published_employees AS (
         SELECT connected.employee_id AS id,
           json_extract(person.attributes_json, '$.officialName') AS official_name,
           json_extract(employee.attributes_json, '$.employeeCode') AS employee_code,
           json_extract(person.attributes_json, '$.email') AS email,
           json_extract(person.attributes_json, '$.phone') AS phone
         FROM connected_employees AS connected
         JOIN profiles AS employee ON employee.organization_id = connected.organization_id
           AND employee.resource_type = 'employee' AND employee.resource_id = connected.resource_id
         JOIN profiles AS person ON person.organization_id = employee.organization_id
           AND person.resource_type = 'person'
           AND person.resource_id = json_extract(employee.attributes_json, '$.personId')
       )
       SELECT employee.id,
         CASE WHEN connected.employee_id IS NULL THEN employee.employee_code
           ELSE published.employee_code END AS employeeCode,
         CASE WHEN connected.employee_id IS NULL THEN employee.official_name
           ELSE published.official_name END AS officialName,
         CASE WHEN connected.employee_id IS NULL THEN employee.email ELSE published.email END AS email,
         CASE WHEN connected.employee_id IS NULL THEN employee.phone ELSE published.phone END AS phone
       FROM company_employees AS employee
       LEFT JOIN (SELECT DISTINCT employee_id FROM connected_employees) AS connected
         ON connected.employee_id = employee.id
       LEFT JOIN published_employees AS published ON published.id = employee.id
       ORDER BY employee.id`,
    )
      .bind(effectiveOn)
      .all<EmployeeRow>()
  }

  async readAllSnapshot(asOf?: CalendarDate): Promise<WorkforceSnapshotReadResult> {
    try {
      const [sourceSchedules, employees, links, assignments, responsibilities, baselineStates] =
        await Promise.all([
          new EmployeeLifecycleAdapter(this.c).loadOrganizationSchedules(),
          this.readEmployees(asOf),
          new CompanyAccountEmployeeLinksReadAdapter(this.c).findMany({ asOf }),
          this.c.env.DB.prepare(
            `SELECT period_id AS periodId, revision, employment_id AS employmentId,
                  employee_id AS employeeId, organization_unit_id AS organizationUnitId,
                  assignment_type AS assignmentType, position_title AS positionTitle,
                  manager_employee_id AS managerEmployeeId, starts_on AS startsOn,
                  ends_on AS endsOn, is_void AS isVoid,
                  recorded_by_action_id AS recordedByActionId, recorded_at AS recordedAt
             FROM company_organization_assignment_period_versions
             ORDER BY period_id, revision`,
          ).all<AssignmentRow>(),
          this.c.env.DB.prepare(
            `SELECT period_id AS periodId, revision, employment_id AS employmentId,
                  employee_id AS employeeId, organization_unit_id AS organizationUnitId,
                  responsibility_type AS responsibilityType, starts_on AS startsOn,
                  ends_on AS endsOn, is_void AS isVoid,
                  recorded_by_action_id AS recordedByActionId, recorded_at AS recordedAt
             FROM company_organization_responsibility_period_versions
             ORDER BY period_id, revision`,
          ).all<ResponsibilityRow>(),
          new ReadWorkforceBaselineStatesAdapter(this.c.env.DB).readWorkforceBaselineStates(),
        ])
      if (sourceSchedules instanceof CompanyOperationError) {
        return { ok: false, cause: sourceSchedules }
      }

      if (links instanceof Error) return { ok: false, cause: links }

      const canonicalSchedules = attachOrganizationPeriods({
        schedules: toWorkforceLifecycleSchedules(sourceSchedules),
        assignmentRows: assignments.results.map((row) => ({ ...row, isVoid: row.isVoid === 1 })),
        responsibilityRows: responsibilities.results.map((row) => ({
          ...row,
          isVoid: row.isVoid === 1,
        })),
      })
      const schedules = new Map(
        canonicalSchedules.map((schedule) => [schedule.employeeId, schedule]),
      )
      const accountRows = await new SystemAccountRepository({ database: this.c.env.DB }).findMany(
        links.flatMap((link) => {
          const accountId = zAccountId.safeParse(link.accountId)
          return accountId.success ? [accountId.data] : []
        }),
      )
      if (accountRows instanceof Error) return { ok: false, cause: accountRows }
      const activeAccountIds = new Set(
        accountRows
          .filter((account) => account.status === "active")
          .map((account) => String(account.id)),
      )
      const linksByEmployee = new Map(
        links.flatMap((link) =>
          activeAccountIds.has(link.accountId) ? [[link.employeeId, link] as const] : [],
        ),
      )

      return {
        ok: true,
        schedules: employees.results.map((employee) => {
          const employeeId = employee.id
          const schedule = schedules.get(employeeId) ?? emptySchedule(employeeId)
          const link = linksByEmployee.get(employee.id)

          return {
            employee: {
              id: employeeId,
              // 接続済みで有効な公開 resource の無い従業員は空の氏名で返し、正規の形式の検証で拒否させる。
              officialName: employee.officialName ?? "",
              employeeCode: employee.employeeCode,
              email: employee.email,
              phone: employee.phone,
            },
            baselineState: baselineStates.get(employeeId),
            employments: schedule.employments,
            statuses: schedule.statuses,
            assignments: schedule.assignments,
            responsibilities: schedule.responsibilities,
            accountLink:
              link === undefined
                ? null
                : {
                    accountId: restoreWorkforceId("system_account", link.accountId),
                    employeeId,
                  },
          }
        }),
      }
    } catch (cause) {
      return { ok: false, cause }
    }
  }
}

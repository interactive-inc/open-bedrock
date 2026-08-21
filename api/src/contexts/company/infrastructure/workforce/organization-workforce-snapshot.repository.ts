import type {
  WorkforceSnapshotReadPort,
  WorkforceSnapshotReadResult,
} from "@/contexts/company/domain/definitions/organization-change.definition"
import {
  toWorkforceEmployeeId,
  toWorkforceLifecycleSchedules,
} from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle.repository"
import {
  attachOrganizationPeriods,
  type OrgAssignmentProjectionRow,
  type OrgResponsibilityProjectionRow,
} from "@/contexts/company/infrastructure/workforce/organization-period-row.adapter.repository"
import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { readWorkforceBaselineStates } from "@/contexts/company/infrastructure/workforce/read-workforce-baseline-states.repository"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account.repository"

type EmployeeRow = Readonly<{
  id: number
  code: string | null
  name: string
  phone: string | null
}>

type LinkRow = Readonly<{
  account_id: string
  employee_id: number
}>

type AssignmentRow = Omit<OrgAssignmentProjectionRow, "isVoid"> & Readonly<{ isVoid: number }>
type ResponsibilityRow = Omit<OrgResponsibilityProjectionRow, "isVoid"> &
  Readonly<{ isVoid: number }>

function emptySchedule(
  employeeId: ReturnType<typeof toWorkforceEmployeeId>,
): WorkforceLifecycleSchedule {
  return { employeeId, employments: [], statuses: [], assignments: [], responsibilities: [] }
}

/** 既存Employee・lifecycle保存を共通の全社Workforce snapshotへ接続する。 */
export class OrganizationWorkforceSnapshotRepository implements WorkforceSnapshotReadPort {
  constructor(private readonly c: CompanyContext) {
    Object.freeze(this)
  }

  async readAllSnapshot(): Promise<WorkforceSnapshotReadResult> {
    try {
      const [sourceSchedules, employees, links, assignments, responsibilities, baselineStates] =
        await Promise.all([
          new EmployeeLifecycleRepository(this.c).loadOrganizationSchedules(),
          this.c.env.DB.prepare(
            "SELECT id, code, name, phone FROM employees ORDER BY id",
          ).all<EmployeeRow>(),
          this.c.env.DB.prepare(
            `SELECT account_id, employee_id
             FROM account_employee_links
             ORDER BY employee_id, account_id`,
          ).all<LinkRow>(),
          this.c.env.DB.prepare(
            `SELECT period_id AS periodId, revision, employment_id AS employmentId,
                  employee_id AS employeeId, organization_unit_id AS organizationUnitId,
                  assignment_type AS assignmentType, position_title AS positionTitle,
                  manager_employee_id AS managerEmployeeId, starts_on AS startsOn,
                  ends_on AS endsOn, is_void AS isVoid,
                  recorded_by_action_id AS recordedByActionId, recorded_at AS recordedAt
             FROM organization_assignment_period_versions
             ORDER BY period_id, revision`,
          ).all<AssignmentRow>(),
          this.c.env.DB.prepare(
            `SELECT period_id AS periodId, revision, employment_id AS employmentId,
                  employee_id AS employeeId, organization_unit_id AS organizationUnitId,
                  responsibility_type AS responsibilityType, starts_on AS startsOn,
                  ends_on AS endsOn, is_void AS isVoid,
                  recorded_by_action_id AS recordedByActionId, recorded_at AS recordedAt
             FROM organization_responsibility_period_versions
             ORDER BY period_id, revision`,
          ).all<ResponsibilityRow>(),
          readWorkforceBaselineStates(this.c.env.DB),
        ])
      if (sourceSchedules instanceof CompanyOperationError) {
        return { ok: false, cause: sourceSchedules }
      }

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
      const accountRows = await Promise.all(
        links.results.map(async (link) => {
          const accountId = zAccountId.safeParse(link.account_id)
          return accountId.success
            ? new SystemAccountRepository({ database: this.c.env.DB }).findById(accountId.data)
            : null
        }),
      )
      const unavailableAccount = accountRows.find((account) => account instanceof Error)
      if (unavailableAccount instanceof Error) return { ok: false, cause: unavailableAccount }
      const linksByEmployee = new Map(
        links.results.flatMap((link, index) =>
          !(accountRows[index] instanceof Error) && accountRows[index]?.status === "active"
            ? [[link.employee_id, link] as const]
            : [],
        ),
      )

      return {
        ok: true,
        schedules: employees.results.map((employee) => {
          const employeeId = toWorkforceEmployeeId(employee.id)
          const schedule = schedules.get(employeeId) ?? emptySchedule(employeeId)
          const link = linksByEmployee.get(employee.id)

          return {
            employee: {
              id: employeeId,
              officialName: employee.name,
              employeeCode: employee.code,
              email: null,
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
                    accountId: restoreWorkforceId("system_account", link.account_id),
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

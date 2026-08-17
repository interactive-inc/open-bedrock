import type {
  WorkforceSnapshotReadPort,
  WorkforceSnapshotReadResult,
} from "@/contexts/company/application/workforce/apply-organization-change"
import {
  toWorkforceEmployeeId,
  toWorkforceLifecycleSchedules,
} from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/workforce-id"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import {
  attachOrganizationPeriods,
  type OrgAssignmentProjectionRow,
  type OrgResponsibilityProjectionRow,
} from "@/contexts/company/infrastructure/workforce/organization-period-row.adapter"
import type { Context } from "@/env"
import { ApplicationError } from "@/lib/errors"
import { readWorkforceBaselineStates } from "@/contexts/company/infrastructure/workforce/read-workforce-baseline-states"

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
  constructor(private readonly c: Context) {
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
            `SELECT CAST(link.account_id AS TEXT) AS account_id, link.employee_id
             FROM account_employee_links AS link
             JOIN system_accounts AS account ON account.id = CAST(link.account_id AS TEXT)
             WHERE account.status = 'active'
             ORDER BY link.employee_id, account.id`,
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
      if (sourceSchedules instanceof ApplicationError) {
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
      const linksByEmployee = new Map(links.results.map((link) => [link.employee_id, link]))

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

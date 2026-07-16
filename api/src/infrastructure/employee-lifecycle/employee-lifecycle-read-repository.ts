import type { LifecycleEmployeeStatus } from "@/domain/employee-lifecycle/lifecycle-types"
import type { Context } from "@/env"
import { ApplicationError, UnexpectedError } from "@/lib/errors"

export type LifecycleAssignmentState = {
  periodId: string
  employmentPeriodId: string
  departmentCode: string
  departmentName: string
  assignmentType: "primary" | "concurrent"
  positionTitle: string | null
  managerEmployeeId: number | null
  managerEmployeeCode: string | null
  startsOn: string
  endsOn: string | null
}

export type EmployeeLifecycleState = {
  employeeId: number
  employeeCode: string
  asOf: string
  status: LifecycleEmployeeStatus
  archived: boolean
  employmentPeriodId: string | null
  primaryAssignment: LifecycleAssignmentState | null
  concurrentAssignments: ReadonlyArray<LifecycleAssignmentState>
  responsibilityDepartmentCodes: ReadonlyArray<string>
  employeeRevision: number
  organizationRevision: number
}

type EmployeeRow = {
  id: number
  code: string
  archived_at: number | null
  employee_revision: number
  organization_revision: number
}

type EmploymentRow = {
  period_id: string
  employee_id: number
  starts_on: string
  ends_on: string | null
}

type StatusRow = EmploymentRow & {
  employment_period_id: string
  status: "active" | "leave"
}

type AssignmentRow = EmploymentRow & {
  employment_period_id: string
  department_code: string
  department_name: string
  assignment_type: "primary" | "concurrent"
  position_title: string | null
  manager_employee_id: number | null
  manager_employee_code: string | null
}

type ResponsibilityRow = EmploymentRow & {
  department_code: string
}

function contains(row: { starts_on: string; ends_on: string | null }, asOf: string): boolean {
  return row.starts_on <= asOf && (row.ends_on === null || asOf < row.ends_on)
}

function placeholders(ids: ReadonlyArray<number>): string {
  return ids.map((_, index) => `?${index + 1}`).join(", ")
}

export class EmployeeLifecycleReadRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findStatesAt(
    employeeIds: ReadonlyArray<number>,
    asOf: string,
  ): Promise<ReadonlyMap<number, EmployeeLifecycleState> | ApplicationError> {
    const ids = [...new Set(employeeIds)]
    if (ids.length === 0) return new Map()
    const idList = placeholders(ids)

    try {
      const [employeeRows, employmentRows, statusRows, assignmentRows, responsibilityRows] =
        await Promise.all([
          this.c.env.DB.prepare(
            `SELECT employee.id, employee.code, employee.archived_at,
                      COALESCE(revision.revision, 0) AS employee_revision,
                      COALESCE((SELECT revision FROM organization_lifecycle_state WHERE id = 1), 0)
                        AS organization_revision
               FROM employees AS employee
               LEFT JOIN employee_lifecycle_revisions AS revision
                 ON revision.employee_id = employee.id
               WHERE employee.id IN (${idList})`,
          )
            .bind(...ids)
            .all<EmployeeRow>(),
          this.c.env.DB.prepare(
            `SELECT current.period_id, current.employee_id, current.starts_on, current.ends_on
               FROM employment_period_versions AS current
               WHERE current.employee_id IN (${idList})
                 AND current.revision = (
                   SELECT MAX(candidate.revision)
                   FROM employment_period_versions AS candidate
                   WHERE candidate.period_id = current.period_id
                 )
                 AND current.is_void = 0`,
          )
            .bind(...ids)
            .all<EmploymentRow>(),
          this.c.env.DB.prepare(
            `SELECT current.period_id, current.employment_period_id, current.employee_id,
                      current.status, current.starts_on, current.ends_on
               FROM employee_status_period_versions AS current
               WHERE current.employee_id IN (${idList})
                 AND current.revision = (
                   SELECT MAX(candidate.revision)
                   FROM employee_status_period_versions AS candidate
                   WHERE candidate.period_id = current.period_id
                 )
                 AND current.is_void = 0`,
          )
            .bind(...ids)
            .all<StatusRow>(),
          this.c.env.DB.prepare(
            `SELECT current.period_id, current.employment_period_id, current.employee_id,
                      current.department_code, department.name AS department_name,
                      current.assignment_type, current.position_title,
                      current.manager_employee_id, manager.code AS manager_employee_code,
                      current.starts_on, current.ends_on
               FROM org_assignment_period_versions AS current
               INNER JOIN org_departments AS organization
                 ON organization.code = current.department_code
               INNER JOIN departments AS department ON department.id = organization.department_id
               LEFT JOIN employees AS manager ON manager.id = current.manager_employee_id
               WHERE current.employee_id IN (${idList})
                 AND current.revision = (
                   SELECT MAX(candidate.revision)
                   FROM org_assignment_period_versions AS candidate
                   WHERE candidate.period_id = current.period_id
                 )
                 AND current.is_void = 0`,
          )
            .bind(...ids)
            .all<AssignmentRow>(),
          this.c.env.DB.prepare(
            `SELECT current.period_id, current.employee_id, current.department_code,
                      current.starts_on, current.ends_on
               FROM org_responsibility_period_versions AS current
               WHERE current.employee_id IN (${idList})
                 AND current.revision = (
                   SELECT MAX(candidate.revision)
                   FROM org_responsibility_period_versions AS candidate
                   WHERE candidate.period_id = current.period_id
                 )
                 AND current.is_void = 0`,
          )
            .bind(...ids)
            .all<ResponsibilityRow>(),
        ])
      const states = new Map<number, EmployeeLifecycleState>()

      for (const employee of employeeRows.results) {
        const employments = employmentRows.results.filter((row) => row.employee_id === employee.id)
        const employment = employments.find((row) => contains(row, asOf))
        const status =
          employment === undefined
            ? employments.some((row) => row.starts_on < asOf)
              ? "retired"
              : employments.some((row) => row.starts_on > asOf)
                ? "prehire"
                : "retired"
            : (statusRows.results.find(
                (row) =>
                  row.employee_id === employee.id &&
                  row.employment_period_id === employment.period_id &&
                  contains(row, asOf),
              )?.status ?? "active")
        const assignments = assignmentRows.results
          .filter(
            (row) =>
              row.employee_id === employee.id &&
              row.employment_period_id === employment?.period_id &&
              contains(row, asOf),
          )
          .map((row) => ({
            periodId: row.period_id,
            employmentPeriodId: row.employment_period_id,
            departmentCode: row.department_code,
            departmentName: row.department_name,
            assignmentType: row.assignment_type,
            positionTitle: row.position_title,
            managerEmployeeId: row.manager_employee_id,
            managerEmployeeCode: row.manager_employee_code,
            startsOn: row.starts_on,
            endsOn: row.ends_on,
          }))
          .sort(
            (left, right) =>
              left.departmentCode.localeCompare(right.departmentCode) ||
              left.periodId.localeCompare(right.periodId),
          )

        states.set(employee.id, {
          employeeId: employee.id,
          employeeCode: employee.code,
          asOf,
          status,
          archived: employee.archived_at !== null,
          employmentPeriodId: employment?.period_id ?? null,
          primaryAssignment:
            assignments.find((assignment) => assignment.assignmentType === "primary") ?? null,
          concurrentAssignments: assignments.filter(
            (assignment) => assignment.assignmentType === "concurrent",
          ),
          responsibilityDepartmentCodes: responsibilityRows.results
            .filter((row) => row.employee_id === employee.id && contains(row, asOf))
            .map((row) => row.department_code)
            .sort(),
          employeeRevision: employee.employee_revision,
          organizationRevision: employee.organization_revision,
        })
      }

      return states
    } catch (cause) {
      return new UnexpectedError("基準日現在の人事状態を取得できません", { cause })
    }
  }
}

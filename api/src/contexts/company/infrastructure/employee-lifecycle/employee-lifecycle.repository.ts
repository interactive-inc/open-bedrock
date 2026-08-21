import type {
  EmployeeStatusPeriod,
  EmploymentPeriod,
  LifecycleSchedule,
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
} from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"
import type {
  LifecycleDepartmentReference,
  LifecycleEmployeeReference,
} from "@/contexts/company/domain/policies/project-personnel-action.policy"
import { CompanyOperationError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"

type EmploymentRow = {
  period_id: string
  revision: number
  employee_id: number
  starts_on: string
  ends_on: string | null
  is_void: number
  recorded_by_action_id: string
  recorded_at: number
}

type StatusRow = EmploymentRow & {
  employment_period_id: string
  status: "active" | "leave"
}

type AssignmentRow = EmploymentRow & {
  employment_period_id: string
  department_code: string
  assignment_type: "primary" | "concurrent"
  position_title: string | null
  manager_employee_id: number | null
}

type ResponsibilityRow = Omit<EmploymentRow, "employee_id"> & {
  department_code: string
  responsibility_type: "department_manager"
  employee_id: number
}

function toEmployment(row: EmploymentRow): EmploymentPeriod {
  return {
    periodId: row.period_id,
    revision: row.revision,
    employeeId: row.employee_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isVoid: row.is_void === 1,
    recordedByActionId: row.recorded_by_action_id,
    recordedAt: row.recorded_at,
  }
}

function toStatus(row: StatusRow): EmployeeStatusPeriod {
  return {
    ...toEmployment(row),
    employmentPeriodId: row.employment_period_id,
    status: row.status,
  }
}

function toAssignment(row: AssignmentRow): OrgAssignmentPeriod {
  return {
    ...toEmployment(row),
    employmentPeriodId: row.employment_period_id,
    departmentCode: row.department_code,
    assignmentType: row.assignment_type,
    positionTitle: row.position_title,
    managerEmployeeId: row.manager_employee_id,
  }
}

function toResponsibility(row: ResponsibilityRow): OrgResponsibilityPeriod {
  return {
    periodId: row.period_id,
    revision: row.revision,
    departmentCode: row.department_code,
    responsibilityType: row.responsibility_type,
    employeeId: row.employee_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isVoid: row.is_void === 1,
    recordedByActionId: row.recorded_by_action_id,
    recordedAt: row.recorded_at,
  }
}

function repositoryError(cause: unknown): CompanyOperationError {
  return new CompanyUnexpectedError("人事ライフサイクルの読み取りに失敗しました", { cause })
}

const employmentSelect = `
  SELECT period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at
  FROM employment_period_versions AS current
  WHERE current.revision = (
    SELECT MAX(candidate.revision)
    FROM employment_period_versions AS candidate
    WHERE candidate.period_id = current.period_id
  ) AND current.is_void = 0`

const statusSelect = `
  SELECT period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at
  FROM employee_status_period_versions AS current
  WHERE current.revision = (
    SELECT MAX(candidate.revision)
    FROM employee_status_period_versions AS candidate
    WHERE candidate.period_id = current.period_id
  ) AND current.is_void = 0`

const assignmentSelect = `
  SELECT period_id, revision, employment_period_id, employee_id, department_code,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at
  FROM employee_org_assignment_period_versions AS current
  WHERE current.revision = (
    SELECT MAX(candidate.revision)
    FROM employee_org_assignment_period_versions AS candidate
    WHERE candidate.period_id = current.period_id
  ) AND current.is_void = 0`

const responsibilitySelect = `
  SELECT period_id, revision, department_code, responsibility_type, employee_id,
         starts_on, ends_on, is_void, recorded_by_action_id, recorded_at
  FROM employee_org_responsibility_period_versions AS current
  WHERE current.revision = (
    SELECT MAX(candidate.revision)
    FROM employee_org_responsibility_period_versions AS candidate
    WHERE candidate.period_id = current.period_id
  ) AND current.is_void = 0`

export class EmployeeLifecycleRepository {
  constructor(private readonly c: CompanyContext) {
    Object.freeze(this)
  }

  async loadSchedule(employeeId: number): Promise<LifecycleSchedule | CompanyOperationError> {
    try {
      const db = this.c.env.DB
      const [employments, statuses, assignments, responsibilities] = await Promise.all([
        db
          .prepare(`${employmentSelect} AND current.employee_id = ?1 ORDER BY starts_on, period_id`)
          .bind(employeeId)
          .all<EmploymentRow>(),
        db
          .prepare(`${statusSelect} AND current.employee_id = ?1 ORDER BY starts_on, period_id`)
          .bind(employeeId)
          .all<StatusRow>(),
        db
          .prepare(`${assignmentSelect} AND current.employee_id = ?1 ORDER BY starts_on, period_id`)
          .bind(employeeId)
          .all<AssignmentRow>(),
        db
          .prepare(
            `${responsibilitySelect} AND current.employee_id = ?1 ORDER BY starts_on, period_id`,
          )
          .bind(employeeId)
          .all<ResponsibilityRow>(),
      ])

      return {
        employments: employments.results.map(toEmployment),
        statuses: statuses.results.map(toStatus),
        assignments: assignments.results.map(toAssignment),
        responsibilities: responsibilities.results.map(toResponsibility),
      }
    } catch (cause) {
      return repositoryError(cause)
    }
  }

  async loadOrganizationSchedules(): Promise<
    ReadonlyArray<LifecycleSchedule> | CompanyOperationError
  > {
    try {
      const db = this.c.env.DB
      const [employments, statuses, assignments, responsibilities] = await Promise.all([
        db
          .prepare(`${employmentSelect} ORDER BY employee_id, starts_on, period_id`)
          .all<EmploymentRow>(),
        db.prepare(`${statusSelect} ORDER BY employee_id, starts_on, period_id`).all<StatusRow>(),
        db
          .prepare(`${assignmentSelect} ORDER BY employee_id, starts_on, period_id`)
          .all<AssignmentRow>(),
        db
          .prepare(`${responsibilitySelect} ORDER BY employee_id, starts_on, period_id`)
          .all<ResponsibilityRow>(),
      ])
      const employeeIds = new Set<number>([
        ...employments.results.map((row) => row.employee_id),
        ...statuses.results.map((row) => row.employee_id),
        ...assignments.results.map((row) => row.employee_id),
        ...responsibilities.results.map((row) => row.employee_id),
      ])

      return [...employeeIds]
        .sort((left, right) => left - right)
        .map((employeeId) => ({
          employments: employments.results
            .filter((row) => row.employee_id === employeeId)
            .map(toEmployment),
          statuses: statuses.results.filter((row) => row.employee_id === employeeId).map(toStatus),
          assignments: assignments.results
            .filter((row) => row.employee_id === employeeId)
            .map(toAssignment),
          responsibilities: responsibilities.results
            .filter((row) => row.employee_id === employeeId)
            .map(toResponsibility),
        }))
    } catch (cause) {
      return repositoryError(cause)
    }
  }

  async loadRevisions(
    employeeId: number,
  ): Promise<{ employeeRevision: number; organizationRevision: number } | CompanyOperationError> {
    try {
      const [employeeRevision, organizationRevision] = await Promise.all([
        this.c.env.DB.prepare(
          "SELECT revision FROM employee_lifecycle_revisions WHERE employee_id = ?1",
        )
          .bind(employeeId)
          .first<number>("revision"),
        this.c.env.DB.prepare(
          "SELECT revision FROM organization_lifecycle_states WHERE id = 1",
        ).first<number>("revision"),
      ])

      return {
        employeeRevision: employeeRevision ?? 0,
        organizationRevision: organizationRevision ?? 0,
      }
    } catch (cause) {
      return repositoryError(cause)
    }
  }

  async loadReferences(): Promise<
    | {
        departments: ReadonlyArray<LifecycleDepartmentReference>
        employees: ReadonlyArray<LifecycleEmployeeReference>
      }
    | CompanyOperationError
  > {
    try {
      const [departments, employees] = await Promise.all([
        this.c.env.DB.prepare(
          `SELECT organization.code, department.name, organization.archived_at
             FROM org_departments AS organization
             INNER JOIN departments AS department ON department.id = organization.department_id
             ORDER BY organization.code`,
        ).all<{ code: string; name: string; archived_at: number | null }>(),
        this.c.env.DB.prepare("SELECT id, code FROM employees ORDER BY id").all<{
          id: number
          code: string
        }>(),
      ])

      return {
        departments: departments.results.map((row) => ({
          code: row.code,
          name: row.name,
          archived: row.archived_at !== null,
        })),
        employees: employees.results,
      }
    } catch (cause) {
      return repositoryError(cause)
    }
  }
}

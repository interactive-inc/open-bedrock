import type {
  WorkforceLifecycleReadPort,
  WorkforceLifecycleReadPortResult,
} from "@/contexts/company/application/workforce/read-workforce-state"
import {
  toWorkforceEmployeeId,
  toWorkforceLifecycleSchedules,
} from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import {
  attachOrganizationPeriods,
  type OrgAssignmentProjectionRow,
  type OrgResponsibilityProjectionRow,
} from "@/contexts/company/infrastructure/workforce/organization-period-row.adapter"
import type { Context } from "@/env"
import { ApplicationError } from "@/lib/errors"
import { readWorkforceBaselineStates } from "@/contexts/company/infrastructure/workforce/read-workforce-baseline-states"

type AssignmentRow = Omit<OrgAssignmentProjectionRow, "isVoid"> & Readonly<{ isVoid: number }>
type ResponsibilityRow = Omit<OrgResponsibilityProjectionRow, "isVoid"> &
  Readonly<{ isVoid: number }>

function storageEmployeeId(employeeId: EmployeeId): number | null {
  const match = /^employee:(0|[1-9]\d*)$/.exec(String(employeeId))
  if (match === null) return null

  const value = Number(match[1])
  if (!Number.isSafeInteger(value) || value < 1) return null
  return toWorkforceEmployeeId(value) === employeeId ? value : null
}

function emptySchedule(employeeId: EmployeeId): WorkforceLifecycleSchedule {
  return {
    employeeId,
    employments: [],
    statuses: [],
    assignments: [],
    responsibilities: [],
  }
}

/** open-bedrockのD1 lifecycle tablesを共通Workforce Application portへ接続する。 */
export class EmployeeLifecycleWorkforceRepository implements WorkforceLifecycleReadPort {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findByEmployeeId(employeeId: EmployeeId): Promise<WorkforceLifecycleReadPortResult> {
    const sourceEmployeeId = storageEmployeeId(employeeId)
    if (sourceEmployeeId === null) return { ok: true, schedule: null }

    try {
      const exists = await this.c.env.DB.prepare("SELECT id FROM employees WHERE id = ?1")
        .bind(sourceEmployeeId)
        .first<number>("id")
      if (exists === null) return { ok: true, schedule: null }

      const source = await new EmployeeLifecycleRepository(this.c).loadSchedule(sourceEmployeeId)
      if (source instanceof ApplicationError) return { ok: false, cause: source }

      const [assignments, responsibilities, baselineStates] = await Promise.all([
        this.c.env.DB.prepare(
          `SELECT period_id AS periodId, revision, employment_id AS employmentId,
                  employee_id AS employeeId, organization_unit_id AS organizationUnitId,
                  assignment_type AS assignmentType, position_title AS positionTitle,
                  manager_employee_id AS managerEmployeeId, starts_on AS startsOn,
                  ends_on AS endsOn, is_void AS isVoid,
                  recorded_by_action_id AS recordedByActionId, recorded_at AS recordedAt
             FROM organization_assignment_period_versions
             WHERE employee_id = ?1
             ORDER BY period_id, revision`,
        )
          .bind(employeeId)
          .all<AssignmentRow>(),
        this.c.env.DB.prepare(
          `SELECT period_id AS periodId, revision, employment_id AS employmentId,
                  employee_id AS employeeId, organization_unit_id AS organizationUnitId,
                  responsibility_type AS responsibilityType, starts_on AS startsOn,
                  ends_on AS endsOn, is_void AS isVoid,
                  recorded_by_action_id AS recordedByActionId, recorded_at AS recordedAt
             FROM organization_responsibility_period_versions
             WHERE employee_id = ?1
             ORDER BY period_id, revision`,
        )
          .bind(employeeId)
          .all<ResponsibilityRow>(),
        readWorkforceBaselineStates(this.c.env.DB),
      ])
      const baseSchedule = toWorkforceLifecycleSchedules([source])[0] ?? emptySchedule(employeeId)
      const schedule = attachOrganizationPeriods({
        schedules: [
          {
            ...baseSchedule,
            baselineState: baselineStates.get(employeeId),
          },
        ],
        assignmentRows: assignments.results.map((row) => ({ ...row, isVoid: row.isVoid === 1 })),
        responsibilityRows: responsibilities.results.map((row) => ({
          ...row,
          isVoid: row.isVoid === 1,
        })),
      })[0]

      return {
        ok: true,
        schedule: schedule ?? emptySchedule(employeeId),
      }
    } catch (cause) {
      return { ok: false, cause }
    }
  }
}

import { containsDate } from "@/contexts/company/domain/employee-lifecycle/contains-date"
import { lifecycleBoundaryDates } from "@/contexts/company/domain/employee-lifecycle/lifecycle-boundary-dates"
import type {
  LifecyclePeriodBase,
  LifecycleSchedule,
  OrgAssignmentPeriod,
} from "@/contexts/company/domain/employee-lifecycle/lifecycle-schedule"
import { normalizeLifecycleSchedule } from "@/contexts/company/domain/employee-lifecycle/normalize-lifecycle-schedule"
import { periodContainsPeriod } from "@/contexts/company/domain/employee-lifecycle/period-contains-period"
import { periodsOverlap } from "@/contexts/company/domain/employee-lifecycle/periods-overlap"
import { ApplicationError, ConflictError } from "@/lib/errors"

type ValidateLifecycleSchedulesProps = {
  schedules: ReadonlyArray<LifecycleSchedule>
  departments: ReadonlyArray<string>
}

function conflict(message: string, code: string): ApplicationError {
  return new ConflictError(message, code)
}

function hasOverlap<T extends LifecyclePeriodBase>(periods: ReadonlyArray<T>): boolean {
  return periods.some((left, index) =>
    periods.slice(index + 1).some((right) => periodsOverlap(left, right)),
  )
}

function validateEmploymentAndStatuses(schedule: LifecycleSchedule): ApplicationError | undefined {
  const employeeIds = new Set(schedule.employments.map((period) => period.employeeId))

  for (const employeeId of employeeIds) {
    if (hasOverlap(schedule.employments.filter((period) => period.employeeId === employeeId))) {
      return conflict("雇用期間が重複しています", "employment_period_conflict")
    }
  }

  for (const status of schedule.statuses) {
    const employment = schedule.employments.find(
      (period) =>
        period.periodId === status.employmentPeriodId && period.employeeId === status.employeeId,
    )

    if (employment === undefined || !periodContainsPeriod(employment, status)) {
      return conflict("状態期間が雇用期間の外にあります", "status_period_conflict")
    }
  }

  for (const employment of schedule.employments) {
    const statuses = schedule.statuses
      .filter((status) => status.employmentPeriodId === employment.periodId)
      .sort((left, right) => left.startsOn.localeCompare(right.startsOn))

    if (
      statuses.length === 0 ||
      statuses[0]?.startsOn !== employment.startsOn ||
      statuses.at(-1)?.endsOn !== employment.endsOn
    ) {
      return conflict("雇用期間の状態が全日を覆っていません", "status_period_conflict")
    }

    for (let index = 0; index < statuses.length - 1; index += 1) {
      if (statuses[index]?.endsOn !== statuses[index + 1]?.startsOn) {
        return conflict("状態期間に重複または欠落があります", "status_period_conflict")
      }
    }
  }

  return undefined
}

function validateAssignments(
  schedule: LifecycleSchedule,
  departments: ReadonlySet<string>,
): ApplicationError | undefined {
  for (const assignment of schedule.assignments) {
    const employment = schedule.employments.find(
      (period) =>
        period.periodId === assignment.employmentPeriodId &&
        period.employeeId === assignment.employeeId,
    )

    if (employment === undefined || !periodContainsPeriod(employment, assignment)) {
      return conflict("所属期間が雇用期間の外にあります", "assignment_period_conflict")
    }

    if (!departments.has(assignment.departmentCode)) {
      return conflict("利用できない部署が指定されています", "department_not_active")
    }

    if (assignment.managerEmployeeId === assignment.employeeId) {
      return conflict("本人を直属上司にはできません", "manager_cycle")
    }
  }

  const primary = schedule.assignments.filter(
    (assignment) => assignment.assignmentType === "primary",
  )

  if (hasOverlap(primary)) {
    return conflict("主所属が重複しています", "primary_assignment_conflict")
  }

  for (const assignment of schedule.assignments) {
    const duplicates = schedule.assignments.filter(
      (candidate) =>
        candidate.periodId !== assignment.periodId &&
        candidate.employeeId === assignment.employeeId &&
        candidate.departmentCode === assignment.departmentCode &&
        candidate.assignmentType === assignment.assignmentType,
    )

    if (duplicates.some((candidate) => periodsOverlap(assignment, candidate))) {
      return conflict("同じ部署の所属期間が重複しています", "assignment_period_conflict")
    }
  }

  return undefined
}

function validateResponsibilities(
  schedules: ReadonlyArray<LifecycleSchedule>,
  departments: ReadonlySet<string>,
): ApplicationError | undefined {
  const responsibilities = schedules.flatMap((schedule) => schedule.responsibilities)

  for (const responsibility of responsibilities) {
    if (!departments.has(responsibility.departmentCode)) {
      return conflict("利用できない部署が指定されています", "department_not_active")
    }

    const holder = schedules.find((schedule) =>
      schedule.employments.some((period) => period.employeeId === responsibility.employeeId),
    )
    const employment = holder?.employments.find(
      (period) =>
        period.employeeId === responsibility.employeeId &&
        periodContainsPeriod(period, responsibility),
    )
    const assignment = holder?.assignments.find(
      (period) =>
        period.employeeId === responsibility.employeeId &&
        period.departmentCode === responsibility.departmentCode &&
        periodContainsPeriod(period, responsibility),
    )

    if (employment === undefined) {
      return conflict("部署責任者が対象期間に在籍していません", "manager_not_active")
    }

    if (assignment === undefined) {
      return conflict("部署責任者が対象部署に所属していません", "assignment_period_conflict")
    }
  }

  for (const responsibility of responsibilities) {
    if (
      responsibilities.some(
        (candidate) =>
          candidate.periodId !== responsibility.periodId &&
          candidate.departmentCode === responsibility.departmentCode &&
          candidate.responsibilityType === responsibility.responsibilityType &&
          periodsOverlap(candidate, responsibility),
      )
    ) {
      return conflict("同じ部署の責任期間が重複しています", "assignment_period_conflict")
    }
  }

  return undefined
}

function activeManagersAt(
  schedules: ReadonlyArray<LifecycleSchedule>,
  date: string,
): ReadonlyArray<Pick<OrgAssignmentPeriod, "employeeId" | "managerEmployeeId">> {
  return schedules.flatMap((schedule) =>
    schedule.assignments
      .filter(
        (assignment) => containsDate(assignment, date) && assignment.managerEmployeeId !== null,
      )
      .map(({ employeeId, managerEmployeeId }) => ({ employeeId, managerEmployeeId })),
  )
}

function validateManagersAndCycles(
  schedules: ReadonlyArray<LifecycleSchedule>,
): ApplicationError | undefined {
  const boundaries = lifecycleBoundaryDates(schedules)

  for (const date of boundaries) {
    const relations = activeManagersAt(schedules, date)

    for (const relation of relations) {
      const managerActive = schedules.some((schedule) =>
        schedule.employments.some(
          (employment) =>
            employment.employeeId === relation.managerEmployeeId && containsDate(employment, date),
        ),
      )

      if (!managerActive) {
        return conflict("直属上司が対象日に在籍していません", "manager_not_active")
      }
    }

    const graph = new Map<number, Set<number>>()

    for (const { employeeId, managerEmployeeId } of relations) {
      if (managerEmployeeId === null) {
        continue
      }

      const managers = graph.get(employeeId) ?? new Set<number>()
      managers.add(managerEmployeeId)
      graph.set(employeeId, managers)
    }

    const visiting = new Set<number>()
    const visited = new Set<number>()

    const hasCycleFrom = (employeeId: number): boolean => {
      if (visiting.has(employeeId)) {
        return true
      }

      if (visited.has(employeeId)) {
        return false
      }

      visiting.add(employeeId)

      for (const managerId of graph.get(employeeId) ?? []) {
        if (hasCycleFrom(managerId)) {
          return true
        }
      }

      visiting.delete(employeeId)
      visited.add(employeeId)
      return false
    }

    for (const employeeId of graph.keys()) {
      if (hasCycleFrom(employeeId)) {
        return conflict("上司関係が循環しています", "manager_cycle")
      }
    }
  }

  return undefined
}

export function validateLifecycleSchedules(
  props: ValidateLifecycleSchedulesProps,
): ApplicationError | undefined {
  const schedules = props.schedules.map(normalizeLifecycleSchedule)
  const departments = new Set(props.departments)

  for (const schedule of schedules) {
    const employmentError = validateEmploymentAndStatuses(schedule)

    if (employmentError !== undefined) {
      return employmentError
    }

    const assignmentError = validateAssignments(schedule, departments)

    if (assignmentError !== undefined) {
      return assignmentError
    }
  }

  return validateResponsibilities(schedules, departments) ?? validateManagersAndCycles(schedules)
}

import { isCalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { isCanonicalEmployee } from "@/contexts/company/domain/workforce/is-canonical-employee"
import {
  periodContainsDate,
  workforcePeriodContainsPeriod,
  workforcePeriodsOverlap,
} from "@/contexts/company/domain/workforce/effective-period"
import type {
  EmploymentPeriod,
  WorkforceLifecycleSchedule,
  WorkforcePeriodVersion,
  WorkforceSchedule,
} from "@/contexts/company/domain/workforce/workforce-schedule"
import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import type {
  EmployeeId,
  OrganizationUnitId,
} from "@/contexts/company/domain/workforce/workforce-id"

export const workforceInvariantCodes = [
  "invalid_employee",
  "invalid_period",
  "duplicate_period",
  "employee_mismatch",
  "employment_overlap",
  "status_outside_employment",
  "status_gap_or_overlap",
  "assignment_outside_employment",
  "inactive_organization_unit",
  "primary_assignment_overlap",
  "assignment_overlap",
  "self_manager",
  "responsibility_outside_employment",
  "responsibility_without_assignment",
  "responsibility_overlap",
  "manager_not_active",
  "manager_cycle",
  "account_link_mismatch",
  "duplicate_account_link",
] as const

export type WorkforceInvariantCode = (typeof workforceInvariantCodes)[number]

export type WorkforceInvariantViolation = Readonly<{
  code: WorkforceInvariantCode
  message: string
}>

export type ValidateWorkforceSchedulesProps = Readonly<{
  schedules: ReadonlyArray<WorkforceSchedule>
  activeOrganizationUnitIds: ReadonlySet<OrganizationUnitId>
}>

export type ValidateWorkforceLifecycleSchedulesProps = Readonly<{
  schedules: ReadonlyArray<WorkforceLifecycleSchedule>
  activeOrganizationUnitIds: ReadonlySet<OrganizationUnitId>
}>

function violation(code: WorkforceInvariantCode, message: string): WorkforceInvariantViolation {
  return { code, message }
}

function active<TPeriod extends WorkforcePeriodVersion>(
  periods: ReadonlyArray<TPeriod>,
): ReadonlyArray<TPeriod> {
  return periods.filter((period) => !period.isVoid)
}

function hasOverlap<TPeriod extends WorkforcePeriodVersion>(
  periods: ReadonlyArray<TPeriod>,
): boolean {
  return periods.some((left, index) =>
    periods.slice(index + 1).some((right) => workforcePeriodsOverlap(left, right)),
  )
}

function findEmployment(
  schedule: WorkforceLifecycleSchedule,
  employmentId: string,
): EmploymentPeriod | undefined {
  return active(schedule.employments).find(
    (employment) =>
      employment.employmentId === employmentId && employment.employeeId === schedule.employeeId,
  )
}

function validateEmployee(schedule: WorkforceSchedule): WorkforceInvariantViolation | null {
  const { employee } = schedule
  if (!isCanonicalEmployee(employee)) {
    return violation("invalid_employee", "employee profile is not canonical")
  }

  if (schedule.accountLink !== null && schedule.accountLink.employeeId !== employee.id) {
    return violation("account_link_mismatch", "account link belongs to another employee")
  }
  return null
}

function validateLifecycleOwner(
  schedule: WorkforceLifecycleSchedule,
): WorkforceInvariantViolation | null {
  const ownedPeriods = [
    ...schedule.employments,
    ...schedule.statuses,
    ...schedule.assignments,
    ...schedule.responsibilities,
  ]
  if (ownedPeriods.some((period) => period.employeeId !== schedule.employeeId)) {
    return violation("employee_mismatch", "period belongs to another employee")
  }
  return null
}

function validatePeriodVersions(
  schedule: WorkforceLifecycleSchedule,
): WorkforceInvariantViolation | null {
  const periods = [
    ...schedule.employments,
    ...schedule.statuses,
    ...schedule.assignments,
    ...schedule.responsibilities,
  ]
  const periodIds = new Set<string>()

  for (const period of periods) {
    if (
      !Number.isSafeInteger(period.revision) ||
      period.revision < 1 ||
      !Number.isSafeInteger(period.recordedAt) ||
      period.recordedAt < 0 ||
      !isCalendarDate(period.startsOn) ||
      (period.endsOn !== null &&
        (!isCalendarDate(period.endsOn) || period.startsOn >= period.endsOn))
    ) {
      return violation("invalid_period", "period version is not canonical")
    }
    if (periodIds.has(period.periodId)) {
      return violation("duplicate_period", "schedule contains more than one latest period version")
    }
    periodIds.add(period.periodId)
  }
  return null
}

function validateEmploymentAndStatuses(
  schedule: WorkforceLifecycleSchedule,
): WorkforceInvariantViolation | null {
  const employments = active(schedule.employments)
  if (hasOverlap(employments)) {
    return violation("employment_overlap", "employment periods overlap")
  }

  const statuses = active(schedule.statuses)
  for (const status of statuses) {
    const employment = findEmployment(schedule, status.employmentId)
    if (employment === undefined || !workforcePeriodContainsPeriod(employment, status)) {
      return violation("status_outside_employment", "status is outside its employment")
    }
  }

  for (const employment of employments) {
    const employmentStatuses = statuses
      .filter((status) => status.employmentId === employment.employmentId)
      .sort((left, right) => left.startsOn.localeCompare(right.startsOn))
    if (
      employmentStatuses.length === 0 ||
      employmentStatuses[0]?.startsOn !== employment.startsOn ||
      employmentStatuses.at(-1)?.endsOn !== employment.endsOn
    ) {
      return violation("status_gap_or_overlap", "statuses do not cover the employment")
    }
    for (let index = 0; index < employmentStatuses.length - 1; index += 1) {
      if (employmentStatuses[index]?.endsOn !== employmentStatuses[index + 1]?.startsOn) {
        return violation("status_gap_or_overlap", "statuses contain a gap or overlap")
      }
    }
  }
  return null
}

function validateAssignments(
  schedule: WorkforceLifecycleSchedule,
  activeOrganizationUnitIds: ReadonlySet<OrganizationUnitId>,
): WorkforceInvariantViolation | null {
  const assignments = active(schedule.assignments)
  for (const assignment of assignments) {
    const employment = findEmployment(schedule, assignment.employmentId)
    if (employment === undefined || !workforcePeriodContainsPeriod(employment, assignment)) {
      return violation("assignment_outside_employment", "assignment is outside its employment")
    }
    if (!activeOrganizationUnitIds.has(assignment.organizationUnitId)) {
      return violation(
        "inactive_organization_unit",
        "assignment uses an inactive organization unit",
      )
    }
    if (assignment.managerEmployeeId === assignment.employeeId) {
      return violation("self_manager", "employee cannot manage itself")
    }
  }

  if (hasOverlap(assignments.filter((assignment) => assignment.assignmentType === "PRIMARY"))) {
    return violation("primary_assignment_overlap", "primary assignments overlap")
  }

  for (const assignment of assignments) {
    if (
      assignments.some(
        (candidate) =>
          candidate.periodId !== assignment.periodId &&
          candidate.organizationUnitId === assignment.organizationUnitId &&
          candidate.assignmentType === assignment.assignmentType &&
          workforcePeriodsOverlap(candidate, assignment),
      )
    ) {
      return violation("assignment_overlap", "equivalent assignments overlap")
    }
  }
  return null
}

function validateResponsibilities(
  schedules: ReadonlyArray<WorkforceLifecycleSchedule>,
  activeOrganizationUnitIds: ReadonlySet<OrganizationUnitId>,
): WorkforceInvariantViolation | null {
  const responsibilities = schedules.flatMap((schedule) => active(schedule.responsibilities))
  for (const responsibility of responsibilities) {
    if (!activeOrganizationUnitIds.has(responsibility.organizationUnitId)) {
      return violation(
        "inactive_organization_unit",
        "responsibility uses an inactive organization unit",
      )
    }
    const holder = schedules.find((schedule) => schedule.employeeId === responsibility.employeeId)
    const employment = holder?.employments.find(
      (period) =>
        !period.isVoid &&
        period.employmentId === responsibility.employmentId &&
        workforcePeriodContainsPeriod(period, responsibility),
    )
    if (employment === undefined) {
      return violation(
        "responsibility_outside_employment",
        "responsibility holder is not employed for the full period",
      )
    }
    const assignment = holder?.assignments.find(
      (period) =>
        !period.isVoid &&
        period.employmentId === responsibility.employmentId &&
        period.organizationUnitId === responsibility.organizationUnitId &&
        workforcePeriodContainsPeriod(period, responsibility),
    )
    if (assignment === undefined) {
      return violation(
        "responsibility_without_assignment",
        "responsibility holder is not assigned to the organization unit",
      )
    }
  }

  for (const responsibility of responsibilities) {
    if (
      responsibilities.some(
        (candidate) =>
          candidate.periodId !== responsibility.periodId &&
          candidate.organizationUnitId === responsibility.organizationUnitId &&
          candidate.responsibilityType === responsibility.responsibilityType &&
          workforcePeriodsOverlap(candidate, responsibility),
      )
    ) {
      return violation("responsibility_overlap", "equivalent responsibilities overlap")
    }
  }
  return null
}

function activeAt(schedule: WorkforceLifecycleSchedule, date: CalendarDate): boolean {
  return active(schedule.statuses).some(
    (status) =>
      (status.status === "ACTIVE" || status.status === "ON_LEAVE") &&
      periodContainsDate(status, date),
  )
}

function boundaryDates(
  schedules: ReadonlyArray<WorkforceLifecycleSchedule>,
): ReadonlyArray<CalendarDate> {
  const dates = schedules.flatMap((schedule) =>
    [
      ...schedule.employments,
      ...schedule.statuses,
      ...schedule.assignments,
      ...schedule.responsibilities,
    ].flatMap((period) => [period.startsOn, ...(period.endsOn === null ? [] : [period.endsOn])]),
  )
  return [...new Set(dates)].sort()
}

function activeManagerRelations(
  schedules: ReadonlyArray<WorkforceLifecycleSchedule>,
  date: CalendarDate,
): ReadonlyArray<Readonly<{ employeeId: EmployeeId; managerEmployeeId: EmployeeId }>> {
  return schedules.flatMap((schedule) =>
    active(schedule.assignments).flatMap((assignment) =>
      assignment.managerEmployeeId !== null && periodContainsDate(assignment, date)
        ? [{ employeeId: assignment.employeeId, managerEmployeeId: assignment.managerEmployeeId }]
        : [],
    ),
  )
}

function hasManagerCycle(
  relations: ReadonlyArray<Readonly<{ employeeId: EmployeeId; managerEmployeeId: EmployeeId }>>,
): boolean {
  const graph = new Map<EmployeeId, Set<EmployeeId>>()
  for (const relation of relations) {
    const managers = graph.get(relation.employeeId) ?? new Set<EmployeeId>()
    managers.add(relation.managerEmployeeId)
    graph.set(relation.employeeId, managers)
  }

  const visiting = new Set<EmployeeId>()
  const visited = new Set<EmployeeId>()
  const visit = (employeeId: EmployeeId): boolean => {
    if (visiting.has(employeeId)) return true
    if (visited.has(employeeId)) return false
    visiting.add(employeeId)
    for (const managerId of graph.get(employeeId) ?? []) {
      if (visit(managerId)) return true
    }
    visiting.delete(employeeId)
    visited.add(employeeId)
    return false
  }
  return [...graph.keys()].some(visit)
}

function validateManagers(
  schedules: ReadonlyArray<WorkforceLifecycleSchedule>,
): WorkforceInvariantViolation | null {
  for (const date of boundaryDates(schedules)) {
    const relations = activeManagerRelations(schedules, date)
    for (const relation of relations) {
      const manager = schedules.find(
        (schedule) => schedule.employeeId === relation.managerEmployeeId,
      )
      if (manager === undefined || !activeAt(manager, date)) {
        return violation("manager_not_active", "manager is not active on assignment date")
      }
    }
    if (hasManagerCycle(relations)) {
      return violation("manager_cycle", "management chain contains a cycle")
    }
  }
  return null
}

/** Employee profileから独立した雇用ライフサイクル全体をfail closedで検証する。 */
export function validateWorkforceLifecycleSchedules(
  props: ValidateWorkforceLifecycleSchedulesProps,
): WorkforceInvariantViolation | null {
  const employeeIds = new Set<EmployeeId>()

  for (const schedule of props.schedules) {
    if (employeeIds.has(schedule.employeeId)) {
      return violation("invalid_employee", "employee appears more than once")
    }
    employeeIds.add(schedule.employeeId)

    const result =
      validateLifecycleOwner(schedule) ??
      validatePeriodVersions(schedule) ??
      validateEmploymentAndStatuses(schedule) ??
      validateAssignments(schedule, props.activeOrganizationUnitIds)
    if (result !== null) return result
  }

  return (
    validateResponsibilities(props.schedules, props.activeOrganizationUnitIds) ??
    validateManagers(props.schedules)
  )
}

/** Company workforce全体をEmployee profile・System Account対応も含めて検証する。 */
export function validateWorkforceSchedules(
  props: ValidateWorkforceSchedulesProps,
): WorkforceInvariantViolation | null {
  const accountIds = new Set<string>()

  for (const schedule of props.schedules) {
    if (schedule.accountLink !== null) {
      if (accountIds.has(schedule.accountLink.accountId)) {
        return violation("duplicate_account_link", "system account is linked more than once")
      }
      accountIds.add(schedule.accountLink.accountId)
    }

    const employeeError = validateEmployee(schedule)
    if (employeeError !== null) return employeeError
  }

  return validateWorkforceLifecycleSchedules({
    schedules: props.schedules.map((schedule) => ({
      employeeId: schedule.employee.id,
      employments: schedule.employments,
      statuses: schedule.statuses,
      assignments: schedule.assignments,
      responsibilities: schedule.responsibilities,
    })),
    activeOrganizationUnitIds: props.activeOrganizationUnitIds,
  })
}

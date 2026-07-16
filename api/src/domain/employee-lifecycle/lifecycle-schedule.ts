export type LifecyclePeriodBase = {
  periodId: string
  revision: number
  startsOn: string
  endsOn: string | null
  isVoid: boolean
  recordedByActionId: string
  recordedAt: number
}

export type EmploymentPeriod = LifecyclePeriodBase & {
  employeeId: number
}

export type EmployeeStatusPeriod = LifecyclePeriodBase & {
  employmentPeriodId: string
  employeeId: number
  status: "active" | "leave"
}

export type OrgAssignmentPeriod = LifecyclePeriodBase & {
  employmentPeriodId: string
  employeeId: number
  departmentCode: string
  assignmentType: "primary" | "concurrent"
  positionTitle: string | null
  managerEmployeeId: number | null
}

export type OrgResponsibilityPeriod = LifecyclePeriodBase & {
  departmentCode: string
  responsibilityType: "department_manager"
  employeeId: number
}

export type LifecycleSchedule = {
  employments: ReadonlyArray<EmploymentPeriod>
  statuses: ReadonlyArray<EmployeeStatusPeriod>
  assignments: ReadonlyArray<OrgAssignmentPeriod>
  responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
}

export type EmploymentVersionMutation = {
  periodType: "employment"
  before: EmploymentPeriod | null
  after: EmploymentPeriod
}

export type EmployeeStatusVersionMutation = {
  periodType: "status"
  before: EmployeeStatusPeriod | null
  after: EmployeeStatusPeriod
}

export type OrgAssignmentVersionMutation = {
  periodType: "assignment"
  before: OrgAssignmentPeriod | null
  after: OrgAssignmentPeriod
}

export type OrgResponsibilityVersionMutation = {
  periodType: "responsibility"
  before: OrgResponsibilityPeriod | null
  after: OrgResponsibilityPeriod
}

export type LifecycleVersionMutation =
  | EmploymentVersionMutation
  | EmployeeStatusVersionMutation
  | OrgAssignmentVersionMutation
  | OrgResponsibilityVersionMutation

export function containsDate(period: LifecyclePeriodBase, date: string): boolean {
  return period.startsOn <= date && (period.endsOn === null || date < period.endsOn)
}

export function periodsOverlap(left: LifecyclePeriodBase, right: LifecyclePeriodBase): boolean {
  return (
    (right.endsOn === null || left.startsOn < right.endsOn) &&
    (left.endsOn === null || right.startsOn < left.endsOn)
  )
}

export function periodContainsPeriod(
  container: LifecyclePeriodBase,
  nested: LifecyclePeriodBase,
): boolean {
  return (
    container.startsOn <= nested.startsOn &&
    (container.endsOn === null || (nested.endsOn !== null && nested.endsOn <= container.endsOn))
  )
}

function latestVisible<T extends LifecyclePeriodBase>(periods: ReadonlyArray<T>): ReadonlyArray<T> {
  const latest = new Map<string, T>()

  for (const period of periods) {
    const current = latest.get(period.periodId)

    if (current === undefined || period.revision > current.revision) {
      latest.set(period.periodId, period)
    }
  }

  return [...latest.values()]
    .filter((period) => !period.isVoid)
    .sort(
      (left, right) =>
        left.startsOn.localeCompare(right.startsOn) || left.periodId.localeCompare(right.periodId),
    )
}

export function normalizeLifecycleSchedule(schedule: LifecycleSchedule): LifecycleSchedule {
  return {
    employments: latestVisible(schedule.employments),
    statuses: latestVisible(schedule.statuses),
    assignments: latestVisible(schedule.assignments),
    responsibilities: latestVisible(schedule.responsibilities),
  }
}

function applyPeriodMutation<T extends LifecyclePeriodBase>(
  periods: ReadonlyArray<T>,
  after: T,
): ReadonlyArray<T> {
  const next = periods.filter((period) => period.periodId !== after.periodId)

  if (!after.isVoid) {
    next.push(after)
  }

  return latestVisible(next)
}

export function applyLifecycleMutations(
  schedule: LifecycleSchedule,
  mutations: ReadonlyArray<LifecycleVersionMutation>,
): LifecycleSchedule {
  let next = normalizeLifecycleSchedule(schedule)

  for (const mutation of mutations) {
    switch (mutation.periodType) {
      case "employment":
        next = {
          ...next,
          employments: applyPeriodMutation(next.employments, mutation.after),
        }
        break
      case "status":
        next = {
          ...next,
          statuses: applyPeriodMutation(next.statuses, mutation.after),
        }
        break
      case "assignment":
        next = {
          ...next,
          assignments: applyPeriodMutation(next.assignments, mutation.after),
        }
        break
      case "responsibility":
        next = {
          ...next,
          responsibilities: applyPeriodMutation(next.responsibilities, mutation.after),
        }
        break
    }
  }

  return next
}

export function lifecycleBoundaryDates(
  schedules: ReadonlyArray<LifecycleSchedule>,
): ReadonlyArray<string> {
  const dates = new Set<string>()

  for (const schedule of schedules) {
    for (const period of [
      ...schedule.employments,
      ...schedule.statuses,
      ...schedule.assignments,
      ...schedule.responsibilities,
    ]) {
      dates.add(period.startsOn)

      if (period.endsOn !== null) {
        dates.add(period.endsOn)
      }
    }
  }

  return [...dates].sort()
}

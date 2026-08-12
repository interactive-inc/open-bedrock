import { periodContainsDate } from "@/contexts/company/domain/workforce/effective-period"
import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import type {
  EmploymentStatus,
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
  WorkforceLifecycleSchedule,
} from "@/contexts/company/domain/workforce/workforce-schedule"
import type { EmployeeId, EmploymentId } from "@/contexts/company/domain/workforce/workforce-id"

export type WorkforceStateResolutionCode =
  | "employment_state_ambiguous"
  | "status_state_missing"
  | "status_state_ambiguous"
  | "primary_assignment_state_ambiguous"

export class WorkforceStateResolutionError extends Error {
  constructor(readonly code: WorkforceStateResolutionCode) {
    super(code)
    this.name = "WorkforceStateResolutionError"
  }
}

export type WorkforceStateAt = Readonly<{
  employeeId: EmployeeId
  asOf: CalendarDate
  status: EmploymentStatus
  employmentId: EmploymentId | null
  primaryAssignment: OrgAssignmentPeriod | null
  concurrentAssignments: ReadonlyArray<OrgAssignmentPeriod>
  responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
}>

function comparePeriods(
  left: { startsOn: CalendarDate; periodId: string },
  right: { startsOn: CalendarDate; periodId: string },
): number {
  return left.startsOn.localeCompare(right.startsOn) || left.periodId.localeCompare(right.periodId)
}

/** 正規化済みscheduleから、半開区間の基準日時点状態を決定的に解決する。 */
export function resolveWorkforceStateAt(
  schedule: WorkforceLifecycleSchedule,
  asOf: CalendarDate,
): WorkforceStateAt | WorkforceStateResolutionError {
  const employments = schedule.employments.filter((period) => !period.isVoid)
  const currentEmployments = employments.filter((period) => periodContainsDate(period, asOf))
  if (currentEmployments.length > 1) {
    return new WorkforceStateResolutionError("employment_state_ambiguous")
  }

  const employment = currentEmployments[0]
  if (employment === undefined) {
    return {
      employeeId: schedule.employeeId,
      asOf,
      status: employments.some((period) => period.startsOn <= asOf) ? "TERMINATED" : "PRE_HIRE",
      employmentId: null,
      primaryAssignment: null,
      concurrentAssignments: [],
      responsibilities: [],
    }
  }

  const statuses = schedule.statuses.filter(
    (period) =>
      !period.isVoid &&
      period.employmentId === employment.employmentId &&
      periodContainsDate(period, asOf),
  )
  if (statuses.length === 0) {
    return new WorkforceStateResolutionError("status_state_missing")
  }
  if (statuses.length > 1) {
    return new WorkforceStateResolutionError("status_state_ambiguous")
  }

  const assignments = schedule.assignments
    .filter(
      (period) =>
        !period.isVoid &&
        period.employmentId === employment.employmentId &&
        periodContainsDate(period, asOf),
    )
    .sort(comparePeriods)
  const primaryAssignments = assignments.filter(
    (assignment) => assignment.assignmentType === "PRIMARY",
  )
  if (primaryAssignments.length > 1) {
    return new WorkforceStateResolutionError("primary_assignment_state_ambiguous")
  }

  return {
    employeeId: schedule.employeeId,
    asOf,
    status: statuses[0]!.status,
    employmentId: employment.employmentId,
    primaryAssignment: primaryAssignments[0] ?? null,
    concurrentAssignments: assignments.filter(
      (assignment) => assignment.assignmentType === "CONCURRENT",
    ),
    responsibilities: schedule.responsibilities
      .filter(
        (period) =>
          !period.isVoid &&
          period.employmentId === employment.employmentId &&
          periodContainsDate(period, asOf),
      )
      .sort(comparePeriods),
  }
}

import { activeWorkforcePeriods } from "@/contexts/company/domain/workforce/active-workforce-periods"
import { createWorkforceInvariantViolation } from "@/contexts/company/domain/workforce/create-workforce-invariant-violation"
import { findWorkforceEmployment } from "@/contexts/company/domain/workforce/find-workforce-employment"
import { workforcePeriodContainsPeriod } from "@/contexts/company/domain/workforce/workforce-period-contains-period"
import { workforcePeriodsHaveOverlap } from "@/contexts/company/domain/workforce/workforce-periods-have-overlap"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/workforce/workforce-invariant"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"

export function validateWorkforceEmploymentStatuses(
  schedule: WorkforceLifecycleSchedule,
): WorkforceInvariantViolation | null {
  const employments = activeWorkforcePeriods(schedule.employments)
  if (workforcePeriodsHaveOverlap(employments)) {
    return createWorkforceInvariantViolation("employment_overlap", "employment periods overlap")
  }

  const statuses = activeWorkforcePeriods(schedule.statuses)
  for (const status of statuses) {
    const employment = findWorkforceEmployment(schedule, status.employmentId)
    if (employment === undefined || !workforcePeriodContainsPeriod(employment, status)) {
      return createWorkforceInvariantViolation(
        "status_outside_employment",
        "status is outside its employment",
      )
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
      return createWorkforceInvariantViolation(
        "status_gap_or_overlap",
        "statuses do not cover the employment",
      )
    }
    for (let index = 0; index < employmentStatuses.length - 1; index += 1) {
      if (employmentStatuses[index]?.endsOn !== employmentStatuses[index + 1]?.startsOn) {
        return createWorkforceInvariantViolation(
          "status_gap_or_overlap",
          "statuses contain a gap or overlap",
        )
      }
    }
  }
  return null
}

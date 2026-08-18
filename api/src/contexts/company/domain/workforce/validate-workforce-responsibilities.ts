import { activeWorkforcePeriods } from "@/contexts/company/domain/workforce/active-workforce-periods"
import { createWorkforceInvariantViolation } from "@/contexts/company/domain/workforce/create-workforce-invariant-violation"
import { isOrgResponsibilityType } from "@/contexts/company/domain/workforce/is-org-responsibility-type"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/workforce/organization-unit"
import { workforcePeriodContainsPeriod } from "@/contexts/company/domain/workforce/workforce-period-contains-period"
import { workforcePeriodsOverlap } from "@/contexts/company/domain/workforce/workforce-periods-overlap"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/workforce/workforce-invariant"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"

export function validateWorkforceResponsibilities(
  schedules: ReadonlyArray<WorkforceLifecycleSchedule>,
  organizationUnitPeriods: ReadonlyArray<OrganizationUnitPeriod>,
): WorkforceInvariantViolation | null {
  const responsibilities = schedules.flatMap((schedule) =>
    activeWorkforcePeriods(schedule.responsibilities),
  )
  for (const responsibility of responsibilities) {
    if (!isOrgResponsibilityType(responsibility.responsibilityType)) {
      return createWorkforceInvariantViolation(
        "invalid_responsibility",
        "responsibility type is not canonical",
      )
    }
    if (
      !organizationUnitPeriods.some(
        (unit) =>
          !unit.isVoid &&
          unit.organizationUnitId === responsibility.organizationUnitId &&
          workforcePeriodContainsPeriod(unit, responsibility),
      )
    ) {
      return createWorkforceInvariantViolation(
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
      return createWorkforceInvariantViolation(
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
      return createWorkforceInvariantViolation(
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
          candidate.employeeId === responsibility.employeeId &&
          candidate.organizationUnitId === responsibility.organizationUnitId &&
          candidate.responsibilityType === responsibility.responsibilityType &&
          workforcePeriodsOverlap(candidate, responsibility),
      )
    ) {
      return createWorkforceInvariantViolation(
        "responsibility_overlap",
        "equivalent responsibilities overlap",
      )
    }
  }
  return null
}

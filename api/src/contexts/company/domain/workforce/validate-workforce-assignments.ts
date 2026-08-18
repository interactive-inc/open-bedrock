import { activeWorkforcePeriods } from "@/contexts/company/domain/workforce/active-workforce-periods"
import { createWorkforceInvariantViolation } from "@/contexts/company/domain/workforce/create-workforce-invariant-violation"
import { findWorkforceEmployment } from "@/contexts/company/domain/workforce/find-workforce-employment"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/workforce/organization-unit"
import { workforcePeriodContainsPeriod } from "@/contexts/company/domain/workforce/workforce-period-contains-period"
import { workforcePeriodsHaveOverlap } from "@/contexts/company/domain/workforce/workforce-periods-have-overlap"
import { workforcePeriodsOverlap } from "@/contexts/company/domain/workforce/workforce-periods-overlap"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/workforce/workforce-invariant"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"

export function validateWorkforceAssignments(
  schedule: WorkforceLifecycleSchedule,
  organizationUnitPeriods: ReadonlyArray<OrganizationUnitPeriod>,
): WorkforceInvariantViolation | null {
  const assignments = activeWorkforcePeriods(schedule.assignments)
  for (const assignment of assignments) {
    const employment = findWorkforceEmployment(schedule, assignment.employmentId)
    if (employment === undefined || !workforcePeriodContainsPeriod(employment, assignment)) {
      return createWorkforceInvariantViolation(
        "assignment_outside_employment",
        "assignment is outside its employment",
      )
    }
    if (
      !organizationUnitPeriods.some(
        (unit) =>
          !unit.isVoid &&
          unit.organizationUnitId === assignment.organizationUnitId &&
          workforcePeriodContainsPeriod(unit, assignment),
      )
    ) {
      return createWorkforceInvariantViolation(
        "inactive_organization_unit",
        "assignment uses an inactive organization unit",
      )
    }
    if (assignment.managerEmployeeId === assignment.employeeId) {
      return createWorkforceInvariantViolation("self_manager", "employee cannot manage itself")
    }
  }

  if (
    workforcePeriodsHaveOverlap(
      assignments.filter((assignment) => assignment.assignmentType === "PRIMARY"),
    )
  ) {
    return createWorkforceInvariantViolation(
      "primary_assignment_overlap",
      "primary assignments overlap",
    )
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
      return createWorkforceInvariantViolation(
        "assignment_overlap",
        "equivalent assignments overlap",
      )
    }
  }
  return null
}

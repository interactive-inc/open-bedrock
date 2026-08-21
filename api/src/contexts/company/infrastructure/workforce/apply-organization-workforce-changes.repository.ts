import type { OrganizationChangeSet } from "@/contexts/company/domain/workforce/organization-change"
import { OrganizationChangeValidationError } from "@/contexts/company/domain/workforce/organization-change-validation-error"
import { replaceOrganizationChangePeriods } from "@/contexts/company/domain/workforce/replace-organization-change-periods"
import type { WorkforceSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"

export function applyOrganizationWorkforceChanges(
  schedules: ReadonlyArray<WorkforceSchedule>,
  change: OrganizationChangeSet,
): ReadonlyArray<WorkforceSchedule> | OrganizationChangeValidationError {
  const knownEmployeeIds = new Set(schedules.map((schedule) => schedule.employee.id))
  for (const period of [...change.assignments, ...change.responsibilities]) {
    if (!knownEmployeeIds.has(period.employeeId)) {
      return new OrganizationChangeValidationError("unknown_employee")
    }
  }

  const result: WorkforceSchedule[] = []
  for (const schedule of schedules) {
    const assignments = replaceOrganizationChangePeriods(
      schedule.assignments,
      change.assignments.filter((period) => period.employeeId === schedule.employee.id),
    )
    if (assignments instanceof OrganizationChangeValidationError) return assignments
    const responsibilities = replaceOrganizationChangePeriods(
      schedule.responsibilities,
      change.responsibilities.filter((period) => period.employeeId === schedule.employee.id),
    )
    if (responsibilities instanceof OrganizationChangeValidationError) return responsibilities
    result.push({ ...schedule, assignments, responsibilities })
  }
  return result
}

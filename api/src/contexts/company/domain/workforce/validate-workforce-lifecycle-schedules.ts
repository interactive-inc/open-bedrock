import type {
  ValidateWorkforceLifecycleSchedulesProps,
  WorkforceInvariantViolation,
} from "@/contexts/company/domain/workforce/workforce-invariant"
import { createWorkforceInvariantViolation } from "@/contexts/company/domain/workforce/create-workforce-invariant-violation"
import { validateWorkforceLifecycleSchedule } from "@/contexts/company/domain/workforce/validate-workforce-lifecycle-schedule"
import { validateWorkforceManagers } from "@/contexts/company/domain/workforce/validate-workforce-managers"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

export function validateWorkforceLifecycleSchedules(
  props: ValidateWorkforceLifecycleSchedulesProps,
): WorkforceInvariantViolation | null {
  const employeeIds = new Set<EmployeeId>()
  for (const schedule of props.schedules) {
    if (employeeIds.has(schedule.employeeId)) {
      return createWorkforceInvariantViolation(
        "invalid_employee",
        "employee appears more than once",
      )
    }
    employeeIds.add(schedule.employeeId)
    const result = validateWorkforceLifecycleSchedule({
      schedule,
      organizationUnitPeriods: props.organizationUnitPeriods,
    })
    if (result !== null) return result
  }
  return validateWorkforceManagers(props.schedules)
}

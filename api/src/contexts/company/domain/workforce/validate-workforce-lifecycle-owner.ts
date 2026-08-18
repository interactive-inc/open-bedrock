import { createWorkforceInvariantViolation } from "@/contexts/company/domain/workforce/create-workforce-invariant-violation"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/workforce/workforce-invariant"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"

export function validateWorkforceLifecycleOwner(
  schedule: WorkforceLifecycleSchedule,
): WorkforceInvariantViolation | null {
  const ownedPeriods = [
    ...schedule.employments,
    ...schedule.statuses,
    ...schedule.assignments,
    ...schedule.responsibilities,
  ]
  if (ownedPeriods.some((period) => period.employeeId !== schedule.employeeId)) {
    return createWorkforceInvariantViolation(
      "employee_mismatch",
      "period belongs to another employee",
    )
  }
  return null
}

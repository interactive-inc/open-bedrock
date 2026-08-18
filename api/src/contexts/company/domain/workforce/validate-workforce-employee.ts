import { createWorkforceInvariantViolation } from "@/contexts/company/domain/workforce/create-workforce-invariant-violation"
import { isCanonicalEmployee } from "@/contexts/company/domain/workforce/is-canonical-employee"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/workforce/workforce-invariant"
import type { WorkforceSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"

export function validateWorkforceEmployee(
  schedule: WorkforceSchedule,
): WorkforceInvariantViolation | null {
  const { employee } = schedule
  if (!isCanonicalEmployee(employee)) {
    return createWorkforceInvariantViolation(
      "invalid_employee",
      "employee profile is not canonical",
    )
  }

  if (schedule.accountLink !== null && schedule.accountLink.employeeId !== employee.id) {
    return createWorkforceInvariantViolation(
      "account_link_mismatch",
      "account link belongs to another employee",
    )
  }
  return null
}

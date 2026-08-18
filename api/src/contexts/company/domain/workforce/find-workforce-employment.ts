import { activeWorkforcePeriods } from "@/contexts/company/domain/workforce/active-workforce-periods"
import type {
  EmploymentPeriod,
  WorkforceLifecycleSchedule,
} from "@/contexts/company/domain/workforce/workforce-schedule"

export function findWorkforceEmployment(
  schedule: WorkforceLifecycleSchedule,
  employmentId: string,
): EmploymentPeriod | undefined {
  return activeWorkforcePeriods(schedule.employments).find(
    (employment) =>
      employment.employmentId === employmentId && employment.employeeId === schedule.employeeId,
  )
}

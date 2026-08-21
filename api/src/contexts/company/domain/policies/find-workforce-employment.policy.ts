import { activeWorkforcePeriods } from "@/contexts/company/domain/policies/active-workforce-periods.policy"
import type {
  EmploymentPeriod,
  WorkforceLifecycleSchedule,
} from "@/contexts/company/domain/values/workforce-schedule.definition"

export function findWorkforceEmployment(
  schedule: WorkforceLifecycleSchedule,
  employmentId: string,
): EmploymentPeriod | undefined {
  return activeWorkforcePeriods(schedule.employments).find(
    (employment) =>
      employment.employmentId === employmentId && employment.employeeId === schedule.employeeId,
  )
}

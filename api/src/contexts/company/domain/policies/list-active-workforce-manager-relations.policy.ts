import { activeWorkforcePeriods } from "@/contexts/company/domain/policies/active-workforce-periods.policy"
import type { CalendarDate } from "@/contexts/company/domain/values/calendar-date.definition"
import { periodContainsDate } from "@/contexts/company/domain/values/period-contains-date.definition"
import type { WorkforceManagerRelation } from "@/contexts/company/domain/values/workforce-manager-relation.definition"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/values/workforce-schedule.definition"

export function listActiveWorkforceManagerRelations(
  schedules: ReadonlyArray<WorkforceLifecycleSchedule>,
  date: CalendarDate,
): ReadonlyArray<WorkforceManagerRelation> {
  return schedules.flatMap((schedule) =>
    activeWorkforcePeriods(schedule.assignments).flatMap((assignment) =>
      assignment.managerEmployeeId !== null && periodContainsDate(assignment, date)
        ? [{ employeeId: assignment.employeeId, managerEmployeeId: assignment.managerEmployeeId }]
        : [],
    ),
  )
}

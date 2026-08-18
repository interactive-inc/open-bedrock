import { activeWorkforcePeriods } from "@/contexts/company/domain/workforce/active-workforce-periods"
import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { periodContainsDate } from "@/contexts/company/domain/workforce/period-contains-date"
import type { WorkforceManagerRelation } from "@/contexts/company/domain/workforce/workforce-manager-relation"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"

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

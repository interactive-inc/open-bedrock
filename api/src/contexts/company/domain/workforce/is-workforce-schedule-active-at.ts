import { activeWorkforcePeriods } from "@/contexts/company/domain/workforce/active-workforce-periods"
import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { periodContainsDate } from "@/contexts/company/domain/workforce/period-contains-date"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"

export function isWorkforceScheduleActiveAt(
  schedule: WorkforceLifecycleSchedule,
  date: CalendarDate,
): boolean {
  return activeWorkforcePeriods(schedule.statuses).some(
    (status) =>
      (status.status === "ACTIVE" || status.status === "ON_LEAVE") &&
      periodContainsDate(status, date),
  )
}

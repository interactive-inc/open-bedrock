import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"

export function listWorkforceScheduleBoundaryDates(
  schedules: ReadonlyArray<WorkforceLifecycleSchedule>,
): ReadonlyArray<CalendarDate> {
  const dates = schedules.flatMap((schedule) =>
    [
      ...schedule.employments,
      ...schedule.statuses,
      ...schedule.assignments,
      ...schedule.responsibilities,
    ].flatMap((period) => [period.startsOn, ...(period.endsOn === null ? [] : [period.endsOn])]),
  )
  return [...new Set(dates)].sort()
}

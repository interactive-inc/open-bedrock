import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"

export function compareWorkforcePeriods(
  left: { startsOn: CalendarDate; periodId: string },
  right: { startsOn: CalendarDate; periodId: string },
): number {
  return left.startsOn.localeCompare(right.startsOn) || left.periodId.localeCompare(right.periodId)
}

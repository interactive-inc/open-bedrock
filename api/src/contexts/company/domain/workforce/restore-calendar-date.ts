import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { InvalidCalendarDateError } from "@/contexts/company/domain/workforce/invalid-calendar-date-error"
import { isCalendarDate } from "@/contexts/company/domain/workforce/is-calendar-date"

export function restoreCalendarDate(value: string): CalendarDate {
  if (!isCalendarDate(value)) throw new InvalidCalendarDateError()
  return value
}

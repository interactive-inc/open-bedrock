import type { CalendarDate } from "@/contexts/company/domain/values/calendar-date.definition"
import { InvalidCalendarDateError } from "@/contexts/company/domain/errors"
import { isCalendarDate } from "@/contexts/company/domain/values/is-calendar-date.definition"

export function restoreCalendarDate(value: string): CalendarDate {
  if (!isCalendarDate(value)) throw new InvalidCalendarDateError()
  return value
}

import type { CalendarDate } from "@/contexts/company/domain/values/calendar-date.definition"
import type { WorkforcePeriodVersion } from "@/contexts/company/domain/values/workforce-schedule.definition"

/** 半開区間 [startsOn, endsOn) に暦日が含まれるか判定する。 */
export function periodContainsDate(period: WorkforcePeriodVersion, date: CalendarDate): boolean {
  return period.startsOn <= date && (period.endsOn === null || date < period.endsOn)
}

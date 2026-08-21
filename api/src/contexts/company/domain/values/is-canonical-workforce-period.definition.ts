import { isCalendarDate } from "@/contexts/company/domain/values/is-calendar-date.definition"
import type { WorkforcePeriodVersion } from "@/contexts/company/domain/values/workforce-schedule.definition"

export function isCanonicalWorkforcePeriod(period: WorkforcePeriodVersion): boolean {
  return (
    Number.isSafeInteger(period.revision) &&
    period.revision >= 1 &&
    Number.isSafeInteger(period.recordedAt) &&
    period.recordedAt >= 0 &&
    isCalendarDate(period.startsOn) &&
    (period.endsOn === null || (isCalendarDate(period.endsOn) && period.startsOn < period.endsOn))
  )
}

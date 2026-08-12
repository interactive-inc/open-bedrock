import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import type { WorkforcePeriodVersion } from "@/contexts/company/domain/workforce/workforce-schedule"

/** 半開区間 [startsOn, endsOn) に暦日が含まれるか判定する。 */
export function periodContainsDate(period: WorkforcePeriodVersion, date: CalendarDate): boolean {
  return period.startsOn <= date && (period.endsOn === null || date < period.endsOn)
}

/** 2つの半開区間が重なるか判定する。境界の共有は重なりではない。 */
export function workforcePeriodsOverlap(
  left: WorkforcePeriodVersion,
  right: WorkforcePeriodVersion,
): boolean {
  return (
    (right.endsOn === null || left.startsOn < right.endsOn) &&
    (left.endsOn === null || right.startsOn < left.endsOn)
  )
}

/** outerがinnerの半開区間全体を含むか判定する。 */
export function workforcePeriodContainsPeriod(
  outer: WorkforcePeriodVersion,
  inner: WorkforcePeriodVersion,
): boolean {
  return (
    outer.startsOn <= inner.startsOn &&
    (outer.endsOn === null || (inner.endsOn !== null && inner.endsOn <= outer.endsOn))
  )
}

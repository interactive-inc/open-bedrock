import { workforcePeriodsOverlap } from "@/contexts/company/domain/workforce/workforce-periods-overlap"
import type { WorkforcePeriodVersion } from "@/contexts/company/domain/workforce/workforce-schedule"

export function workforcePeriodsHaveOverlap<TPeriod extends WorkforcePeriodVersion>(
  periods: ReadonlyArray<TPeriod>,
): boolean {
  return periods.some((left, index) =>
    periods.slice(index + 1).some((right) => workforcePeriodsOverlap(left, right)),
  )
}

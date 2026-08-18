import type { WorkforcePeriodVersion } from "@/contexts/company/domain/workforce/workforce-schedule"

export function activeWorkforcePeriods<TPeriod extends WorkforcePeriodVersion>(
  periods: ReadonlyArray<TPeriod>,
): ReadonlyArray<TPeriod> {
  return periods.filter((period) => !period.isVoid)
}

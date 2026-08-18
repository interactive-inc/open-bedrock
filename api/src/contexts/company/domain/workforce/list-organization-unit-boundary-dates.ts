import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/workforce/organization-unit"

export function listOrganizationUnitBoundaryDates(
  periods: ReadonlyArray<OrganizationUnitPeriod>,
): ReadonlyArray<CalendarDate> {
  return [
    ...new Set(
      periods.flatMap((period) => [
        period.startsOn,
        ...(period.endsOn === null ? [] : [period.endsOn]),
      ]),
    ),
  ].sort()
}

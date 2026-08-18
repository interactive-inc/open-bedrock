import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/workforce/organization-unit"
import { periodContainsDate } from "@/contexts/company/domain/workforce/period-contains-date"
import type { OrganizationUnitId } from "@/contexts/company/domain/workforce/workforce-id"

export function organizationUnitHierarchyHasCycleAt(
  periods: ReadonlyArray<OrganizationUnitPeriod>,
  date: CalendarDate,
): boolean {
  const parents = new Map<OrganizationUnitId, OrganizationUnitId>()
  for (const period of periods) {
    if (periodContainsDate(period, date) && period.parentOrganizationUnitId !== null) {
      parents.set(period.organizationUnitId, period.parentOrganizationUnitId)
    }
  }

  for (const unitId of parents.keys()) {
    const path = new Set<OrganizationUnitId>()
    let current: OrganizationUnitId | undefined = unitId
    while (current !== undefined) {
      if (path.has(current)) return true
      path.add(current)
      current = parents.get(current)
    }
  }
  return false
}

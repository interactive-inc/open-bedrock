import type { OrganizationUnitPeriod } from "@/contexts/company/domain/workforce/organization-unit"

export function listActiveOrganizationUnitPeriods(
  periods: ReadonlyArray<OrganizationUnitPeriod>,
): ReadonlyArray<OrganizationUnitPeriod> {
  return periods.filter((period) => !period.isVoid)
}

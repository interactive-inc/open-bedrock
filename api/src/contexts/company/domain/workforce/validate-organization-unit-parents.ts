import { createOrganizationInvariantViolation } from "@/contexts/company/domain/workforce/create-organization-invariant-violation"
import type { OrganizationInvariantViolation } from "@/contexts/company/domain/workforce/organization-invariant"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/workforce/organization-unit"
import { workforcePeriodContainsPeriod } from "@/contexts/company/domain/workforce/workforce-period-contains-period"

export function validateOrganizationUnitParents(
  periods: ReadonlyArray<OrganizationUnitPeriod>,
): OrganizationInvariantViolation | null {
  for (const child of periods) {
    if (child.parentOrganizationUnitId === null) continue
    const parent = periods.find(
      (candidate) =>
        candidate.organizationUnitId === child.parentOrganizationUnitId &&
        workforcePeriodContainsPeriod(candidate, child),
    )
    if (parent === undefined) {
      return createOrganizationInvariantViolation(
        "parent_not_active",
        "parent organization unit is not active for the full child period",
      )
    }
  }
  return null
}

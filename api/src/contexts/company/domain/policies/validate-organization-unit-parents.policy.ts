import { OrganizationInvariantViolationValue } from "@/contexts/company/domain/values/organization-invariant-violation.value"
import type { OrganizationInvariantViolation } from "@/contexts/company/domain/definitions/organization-invariant.definition"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/definitions/organization-unit.definition"
import { workforcePeriodContainsPeriod } from "@/contexts/company/domain/policies/workforce-period-contains-period.policy"

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
      return new OrganizationInvariantViolationValue(
        "parent_not_active",
        "parent organization unit is not active for the full child period",
      )
    }
  }
  return null
}

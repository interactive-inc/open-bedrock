import { createOrganizationInvariantViolation } from "@/contexts/company/domain/workforce/create-organization-invariant-violation"
import type { OrganizationInvariantViolation } from "@/contexts/company/domain/workforce/organization-invariant"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/workforce/organization-unit"
import { workforcePeriodsOverlap } from "@/contexts/company/domain/workforce/workforce-periods-overlap"

export function validateOrganizationUnitOverlaps(
  periods: ReadonlyArray<OrganizationUnitPeriod>,
): OrganizationInvariantViolation | null {
  for (const [index, left] of periods.entries()) {
    for (const right of periods.slice(index + 1)) {
      if (!workforcePeriodsOverlap(left, right)) continue
      if (left.organizationUnitId === right.organizationUnitId) {
        return createOrganizationInvariantViolation(
          "organization_unit_overlap",
          "organization unit periods overlap",
        )
      }
      if (left.code === right.code) {
        return createOrganizationInvariantViolation(
          "organization_code_overlap",
          "organization unit codes overlap",
        )
      }
      if (left.kind === "COMPANY" && right.kind === "COMPANY") {
        return createOrganizationInvariantViolation(
          "organization_unit_overlap",
          "company root periods overlap",
        )
      }
    }
  }
  return null
}

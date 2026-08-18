import { createOrganizationInvariantViolation } from "@/contexts/company/domain/workforce/create-organization-invariant-violation"
import { isCalendarDate } from "@/contexts/company/domain/workforce/is-calendar-date"
import { listActiveOrganizationUnitPeriods } from "@/contexts/company/domain/workforce/list-active-organization-unit-periods"
import { listOrganizationUnitBoundaryDates } from "@/contexts/company/domain/workforce/list-organization-unit-boundary-dates"
import { organizationUnitHierarchyHasCycleAt } from "@/contexts/company/domain/workforce/organization-unit-hierarchy-has-cycle-at"
import type { OrganizationInvariantViolation } from "@/contexts/company/domain/workforce/organization-invariant"
import type { OrganizationUnitSnapshot } from "@/contexts/company/domain/workforce/organization-unit"
import { validateOrganizationUnitOverlaps } from "@/contexts/company/domain/workforce/validate-organization-unit-overlaps"
import { validateOrganizationUnitParents } from "@/contexts/company/domain/workforce/validate-organization-unit-parents"
import { validateOrganizationUnitPeriods } from "@/contexts/company/domain/workforce/validate-organization-unit-periods"

export type {
  OrganizationInvariantCode,
  OrganizationInvariantViolation,
} from "@/contexts/company/domain/workforce/organization-invariant"
export { organizationInvariantCodes } from "@/contexts/company/domain/workforce/organization-invariant"

/** OrgUnitの最新revision projectionを全期間についてfail closedで検証する。 */
export function validateOrganizationUnitSnapshot(
  snapshot: OrganizationUnitSnapshot,
): OrganizationInvariantViolation | null {
  if (
    !Number.isSafeInteger(snapshot.revision) ||
    snapshot.revision < 0 ||
    !isCalendarDate(snapshot.asOf)
  ) {
    return createOrganizationInvariantViolation(
      "invalid_snapshot",
      "organization snapshot is not canonical",
    )
  }

  const periods = listActiveOrganizationUnitPeriods(snapshot.units)
  return (
    validateOrganizationUnitPeriods(snapshot.units) ??
    validateOrganizationUnitOverlaps(periods) ??
    validateOrganizationUnitParents(periods) ??
    (listOrganizationUnitBoundaryDates(periods).some((date) =>
      organizationUnitHierarchyHasCycleAt(periods, date),
    )
      ? createOrganizationInvariantViolation(
          "hierarchy_cycle",
          "organization hierarchy contains a cycle",
        )
      : null)
  )
}

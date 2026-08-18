import type { OrganizationChangeSet } from "@/contexts/company/application/workforce/organization-change"
import { OrganizationChangeValidationError } from "@/contexts/company/application/workforce/organization-change-validation-error"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/workforce/organization-unit"
import type { OrganizationUnitId } from "@/contexts/company/domain/workforce/workforce-id"

export function validateOrganizationChangeIdentities(
  currentPeriods: ReadonlyArray<OrganizationUnitPeriod>,
  change: OrganizationChangeSet,
): OrganizationChangeValidationError | null {
  const currentUnitIds = new Set(currentPeriods.map((period) => period.organizationUnitId))
  const newUnitIds = new Set<OrganizationUnitId>()
  for (const identity of change.organizationUnits) {
    if (
      currentUnitIds.has(identity.id) ||
      newUnitIds.has(identity.id) ||
      !Number.isSafeInteger(identity.createdAt) ||
      identity.createdAt < 0
    ) {
      return new OrganizationChangeValidationError("invalid_identity")
    }
    newUnitIds.add(identity.id)
  }
  if (
    change.unitPeriods.some(
      (period) =>
        !currentUnitIds.has(period.organizationUnitId) &&
        !newUnitIds.has(period.organizationUnitId),
    ) ||
    [...newUnitIds].some(
      (unitId) => !change.unitPeriods.some((period) => period.organizationUnitId === unitId),
    )
  ) {
    return new OrganizationChangeValidationError("invalid_identity")
  }
  return null
}

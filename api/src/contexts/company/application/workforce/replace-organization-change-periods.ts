import { OrganizationChangeValidationError } from "@/contexts/company/application/workforce/organization-change-validation-error"
import { organizationChangePeriodHasSameOwner } from "@/contexts/company/application/workforce/organization-change-period-has-same-owner"
import type { OrganizationChangeVersionedPeriod } from "@/contexts/company/application/workforce/organization-change-versioned-period"

export function replaceOrganizationChangePeriods<TPeriod extends OrganizationChangeVersionedPeriod>(
  current: ReadonlyArray<TPeriod>,
  additions: ReadonlyArray<TPeriod>,
): ReadonlyArray<TPeriod> | OrganizationChangeValidationError {
  const latest = new Map(current.map((period) => [period.periodId, period]))
  for (const addition of additions) {
    const previous = latest.get(addition.periodId)
    if (
      addition.revision !== (previous?.revision ?? 0) + 1 ||
      (previous !== undefined && !organizationChangePeriodHasSameOwner(previous, addition))
    ) {
      return new OrganizationChangeValidationError("invalid_revision")
    }
    latest.set(addition.periodId, addition)
  }
  return [...latest.values()]
}

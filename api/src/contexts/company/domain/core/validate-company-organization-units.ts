import type { CompanyResource } from "@/contexts/company/domain/core/company-resource"
import { CompanyResourceValidationError } from "@/contexts/company/domain/core/company-resource-validation-error"
import { toOrganizationUnitPeriod } from "@/contexts/company/domain/core/to-organization-unit-period"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import { validateOrganizationUnitSnapshot } from "@/contexts/company/domain/workforce/validate-organization-unit-snapshot"

export function validateCompanyOrganizationUnits(
  resources: ReadonlyArray<CompanyResource>,
  resultingRevision: number,
): CompanyResourceValidationError | null {
  const units = resources.map(toOrganizationUnitPeriod)
  if (units.some((unit) => unit === null)) {
    return new CompanyResourceValidationError("invalid_organization")
  }
  const error = validateOrganizationUnitSnapshot({
    revision: resultingRevision,
    asOf: restoreCalendarDate("1970-01-01"),
    units: units.filter((unit) => unit !== null),
  })
  return error === null ? null : new CompanyResourceValidationError("invalid_organization")
}

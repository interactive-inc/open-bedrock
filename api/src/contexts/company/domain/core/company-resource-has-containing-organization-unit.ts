import { companyResourceContainsPeriod } from "@/contexts/company/domain/core/company-resource-contains-period"
import type { CompanyResource } from "@/contexts/company/domain/core/company-resource"
import { readCompanyResourceText } from "@/contexts/company/domain/core/read-company-resource-text"

export function companyResourceHasContainingOrganizationUnit(
  resource: CompanyResource,
  organizationUnitId: string,
  activeUnits: ReadonlyArray<CompanyResource>,
): boolean {
  return activeUnits.some(
    (unit) =>
      readCompanyResourceText(unit.attributes, "organizationUnitId") === organizationUnitId &&
      companyResourceContainsPeriod(unit, resource),
  )
}

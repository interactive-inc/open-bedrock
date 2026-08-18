import { companyResourceContainsPeriod } from "@/contexts/company/domain/core/company-resource-contains-period"
import { companyResourceHasContainingOrganizationUnit } from "@/contexts/company/domain/core/company-resource-has-containing-organization-unit"
import type { CompanyResource } from "@/contexts/company/domain/core/company-resource"
import { CompanyResourceValidationError } from "@/contexts/company/domain/core/company-resource-validation-error"
import { readCompanyResourceText } from "@/contexts/company/domain/core/read-company-resource-text"

export function validateCompanyOrganizationalAuthorities(
  authorities: ReadonlyArray<CompanyResource>,
  assignments: ReadonlyArray<CompanyResource>,
  activeUnits: ReadonlyArray<CompanyResource>,
): CompanyResourceValidationError | null {
  for (const authority of authorities) {
    const employeeId = readCompanyResourceText(authority.attributes, "employeeId")
    const employmentId = readCompanyResourceText(authority.attributes, "employmentId")
    const scopeType = readCompanyResourceText(authority.attributes, "scopeType")
    const scopeId = readCompanyResourceText(authority.attributes, "scopeId")
    const authorityType = readCompanyResourceText(authority.attributes, "authority")
    if (
      employeeId === null ||
      employmentId === null ||
      scopeType !== "organization-unit" ||
      scopeId === null ||
      authorityType === null ||
      !companyResourceHasContainingOrganizationUnit(authority, scopeId, activeUnits) ||
      !assignments.some(
        (assignment) =>
          readCompanyResourceText(assignment.attributes, "employeeId") === employeeId &&
          readCompanyResourceText(assignment.attributes, "employmentId") === employmentId &&
          readCompanyResourceText(assignment.attributes, "organizationUnitId") === scopeId &&
          companyResourceContainsPeriod(assignment, authority),
      )
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
  }
  return null
}

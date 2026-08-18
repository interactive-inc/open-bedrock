import { companyResourceHasContainingOrganizationUnit } from "@/contexts/company/domain/core/company-resource-has-containing-organization-unit"
import type { CompanyResource } from "@/contexts/company/domain/core/company-resource"
import { CompanyResourceValidationError } from "@/contexts/company/domain/core/company-resource-validation-error"
import type { OrganizationRelation } from "@/contexts/company/domain/core/organization-relation"
import { organizationRelationsHaveManagementCycle } from "@/contexts/company/domain/core/organization-relations-have-management-cycle"
import { readCompanyResourceText } from "@/contexts/company/domain/core/read-company-resource-text"

export function validateCompanyReportingRelations(
  relationResources: ReadonlyArray<CompanyResource>,
  activeUnits: ReadonlyArray<CompanyResource>,
): CompanyResourceValidationError | null {
  const relations: OrganizationRelation[] = []
  for (const relation of relationResources) {
    const employeeId = readCompanyResourceText(relation.attributes, "employeeId")
    const managerEmployeeId = readCompanyResourceText(relation.attributes, "managerEmployeeId")
    const organizationUnitId = readCompanyResourceText(relation.attributes, "organizationUnitId")
    if (
      employeeId === null ||
      managerEmployeeId === null ||
      organizationUnitId === null ||
      employeeId === managerEmployeeId ||
      !companyResourceHasContainingOrganizationUnit(relation, organizationUnitId, activeUnits)
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
    relations.push({
      employeeId,
      managerEmployeeId,
      organizationUnitId,
      startsOn: relation.effectiveFrom,
      endsOn: relation.effectiveTo,
    })
  }

  const boundaries = [
    ...new Set(
      relations.flatMap((relation) => [
        relation.startsOn,
        ...(relation.endsOn === null ? [] : [relation.endsOn]),
      ]),
    ),
  ]
  return boundaries.some((date) => organizationRelationsHaveManagementCycle(relations, date))
    ? new CompanyResourceValidationError("invalid_organization")
    : null
}

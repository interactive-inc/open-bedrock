import { companyResourceHasContainingOrganizationUnit } from "@/contexts/company/domain/core/company-resource-has-containing-organization-unit"
import { companyResourcePeriodsOverlap } from "@/contexts/company/domain/core/company-resource-periods-overlap"
import type { CompanyResource } from "@/contexts/company/domain/core/company-resource"
import { CompanyResourceValidationError } from "@/contexts/company/domain/core/company-resource-validation-error"
import { readCompanyResourceText } from "@/contexts/company/domain/core/read-company-resource-text"
import { orgAssignmentTypes } from "@/contexts/company/domain/workforce/org-assignment-type"

export function validateCompanyAssignments(
  assignments: ReadonlyArray<CompanyResource>,
  activeUnits: ReadonlyArray<CompanyResource>,
): CompanyResourceValidationError | null {
  for (const assignment of assignments) {
    const employeeId = readCompanyResourceText(assignment.attributes, "employeeId")
    const employmentId = readCompanyResourceText(assignment.attributes, "employmentId")
    const organizationUnitId = readCompanyResourceText(assignment.attributes, "organizationUnitId")
    const assignmentType = readCompanyResourceText(assignment.attributes, "assignmentType")
    if (
      employeeId === null ||
      employmentId === null ||
      organizationUnitId === null ||
      assignmentType === null ||
      !orgAssignmentTypes.includes(assignmentType as (typeof orgAssignmentTypes)[number]) ||
      !companyResourceHasContainingOrganizationUnit(assignment, organizationUnitId, activeUnits)
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
    if (
      assignmentType === "PRIMARY" &&
      assignments.some(
        (candidate) =>
          candidate.id !== assignment.id &&
          readCompanyResourceText(candidate.attributes, "employeeId") === employeeId &&
          readCompanyResourceText(candidate.attributes, "assignmentType") === "PRIMARY" &&
          companyResourcePeriodsOverlap(candidate, assignment),
      )
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
  }
  return null
}

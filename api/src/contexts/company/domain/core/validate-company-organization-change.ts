import type {
  CompanyResource,
  CompanyResourceChange,
} from "@/contexts/company/domain/core/company-resource"
import { CompanyResourceValidationError } from "@/contexts/company/domain/core/company-resource-validation-error"
import { mergeCompanyResources } from "@/contexts/company/domain/core/merge-company-resources"
import { validateCompanyAssignments } from "@/contexts/company/domain/core/validate-company-assignments"
import { validateCompanyOrganizationalAuthorities } from "@/contexts/company/domain/core/validate-company-organizational-authorities"
import { validateCompanyOrganizationUnits } from "@/contexts/company/domain/core/validate-company-organization-units"
import { validateCompanyReportingRelations } from "@/contexts/company/domain/core/validate-company-reporting-relations"

export function validateCompanyOrganizationChange(
  currentResources: ReadonlyArray<CompanyResource>,
  change: CompanyResourceChange,
): CompanyResourceValidationError | null {
  const resources = mergeCompanyResources(currentResources, change.resources)
  const organizationUnitResources = resources.filter(
    (resource) => resource.type === "organization-unit",
  )
  const organizationError = validateCompanyOrganizationUnits(
    organizationUnitResources,
    change.expectedRevision + 1,
  )
  if (organizationError !== null) {
    return organizationError
  }

  const activeUnitResources = organizationUnitResources.filter(
    (resource) => resource.state === "active",
  )
  const assignments = resources.filter(
    (resource) => resource.type === "assignment" && resource.state === "active",
  )
  const assignmentError = validateCompanyAssignments(assignments, activeUnitResources)
  if (assignmentError !== null) return assignmentError

  const relationError = validateCompanyReportingRelations(
    resources.filter(
      (resource) => resource.type === "reporting-relation" && resource.state === "active",
    ),
    activeUnitResources,
  )
  if (relationError !== null) return relationError

  return validateCompanyOrganizationalAuthorities(
    resources.filter(
      (resource) => resource.type === "organizational-authority" && resource.state === "active",
    ),
    assignments,
    activeUnitResources,
  )
}

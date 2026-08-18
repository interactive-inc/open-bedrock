import { CompanyResourceValidationError } from "@/contexts/company/domain/core/company-resource-validation-error"
import { hasCompanyResourceRequiredAttributes } from "@/contexts/company/domain/core/has-company-resource-required-attributes"
import { isCompanyJson } from "@/contexts/company/domain/core/is-company-json"
import { isCompanyIdentifier } from "@/contexts/company/domain/core/is-company-identifier"
import type { CompanyResource } from "@/contexts/company/domain/core/company-resource"
import { isCalendarDate } from "@/contexts/company/domain/workforce/is-calendar-date"

export function validateCompanyResource(
  resource: CompanyResource,
): CompanyResourceValidationError | null {
  if (!isCompanyIdentifier(resource.organizationId) || !isCompanyIdentifier(resource.id)) {
    return new CompanyResourceValidationError("invalid_identifier")
  }
  if (!Number.isSafeInteger(resource.revision) || resource.revision < 1) {
    return new CompanyResourceValidationError("invalid_revision")
  }
  if (
    !isCalendarDate(resource.effectiveFrom) ||
    (resource.effectiveTo !== null &&
      (!isCalendarDate(resource.effectiveTo) || resource.effectiveTo <= resource.effectiveFrom))
  ) {
    return new CompanyResourceValidationError("invalid_period")
  }
  if (!isCompanyJson(resource.attributes)) {
    return new CompanyResourceValidationError("invalid_attributes")
  }
  if (!hasCompanyResourceRequiredAttributes(resource)) {
    return new CompanyResourceValidationError("invalid_resource")
  }
  return null
}

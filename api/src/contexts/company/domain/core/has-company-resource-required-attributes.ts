import { companyResourceRequiredAttributes } from "@/contexts/company/domain/core/company-resource-required-attributes"
import type { CompanyResource } from "@/contexts/company/domain/core/company-resource"

export function hasCompanyResourceRequiredAttributes(resource: CompanyResource): boolean {
  return companyResourceRequiredAttributes[resource.type].every((key) => {
    const value = resource.attributes[key]
    return (
      typeof value === "string" &&
      value.length >= 1 &&
      value.length <= 2_000 &&
      value.trim() === value
    )
  })
}

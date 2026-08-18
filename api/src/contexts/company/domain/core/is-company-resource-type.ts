import {
  companyResourceTypes,
  type CompanyResourceType,
} from "@/contexts/company/domain/core/company-resource"

export function isCompanyResourceType(value: string): value is CompanyResourceType {
  return companyResourceTypes.some((type) => type === value)
}

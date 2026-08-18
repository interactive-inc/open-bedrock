import type { CompanyJsonObject } from "@/contexts/company/domain/core/company-resource"

export function readCompanyResourceText(attributes: CompanyJsonObject, key: string): string | null {
  const value = attributes[key]
  return typeof value === "string" && value.length > 0 && value.trim() === value ? value : null
}

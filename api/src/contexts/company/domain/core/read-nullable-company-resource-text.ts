import type { CompanyJsonObject } from "@/contexts/company/domain/core/company-resource"

export function readNullableCompanyResourceText(
  attributes: CompanyJsonObject,
  key: string,
): string | null | undefined {
  const value = attributes[key]
  if (value === null) return null
  return typeof value === "string" && value.length > 0 && value.trim() === value ? value : undefined
}

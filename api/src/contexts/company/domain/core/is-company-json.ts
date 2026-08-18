import type { CompanyJson } from "@/contexts/company/domain/core/company-resource"

export function isCompanyJson(value: unknown, depth = 0): value is CompanyJson {
  if (depth > 20) return false
  if (value === null || typeof value === "boolean" || typeof value === "string") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) {
    return value.length <= 1_000 && value.every((item) => isCompanyJson(item, depth + 1))
  }
  if (typeof value !== "object") return false

  const entries = Object.entries(value)
  return (
    entries.length <= 1_000 &&
    entries.every(
      ([key, item]) => key.length >= 1 && key.length <= 255 && isCompanyJson(item, depth + 1),
    )
  )
}

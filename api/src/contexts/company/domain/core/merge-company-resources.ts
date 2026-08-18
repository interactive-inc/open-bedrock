import type { CompanyResource } from "@/contexts/company/domain/core/company-resource"

export function mergeCompanyResources(
  current: ReadonlyArray<CompanyResource>,
  incoming: ReadonlyArray<CompanyResource>,
): ReadonlyArray<CompanyResource> {
  const merged = new Map(
    current.map((resource) => [`${resource.type}\u0000${resource.id}`, resource]),
  )
  for (const resource of incoming) {
    merged.set(`${resource.type}\u0000${resource.id}`, resource)
  }
  return [...merged.values()]
}

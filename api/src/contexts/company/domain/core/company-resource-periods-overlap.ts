import type { CompanyResource } from "@/contexts/company/domain/core/company-resource"

export function companyResourcePeriodsOverlap(
  left: Pick<CompanyResource, "effectiveFrom" | "effectiveTo">,
  right: Pick<CompanyResource, "effectiveFrom" | "effectiveTo">,
): boolean {
  return (
    (right.effectiveTo === null || left.effectiveFrom < right.effectiveTo) &&
    (left.effectiveTo === null || right.effectiveFrom < left.effectiveTo)
  )
}

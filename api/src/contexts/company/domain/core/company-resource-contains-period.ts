import type { CompanyResource } from "@/contexts/company/domain/core/company-resource"

export function companyResourceContainsPeriod(
  container: Pick<CompanyResource, "effectiveFrom" | "effectiveTo">,
  contained: Pick<CompanyResource, "effectiveFrom" | "effectiveTo">,
): boolean {
  return (
    container.effectiveFrom <= contained.effectiveFrom &&
    (container.effectiveTo === null ||
      (contained.effectiveTo !== null && contained.effectiveTo <= container.effectiveTo))
  )
}

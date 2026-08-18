import type { CompanyResourceQuery } from "@/contexts/company/application/core/company-resource-persistence"
import { isCompanyIdentifier } from "@/contexts/company/domain/core/is-company-identifier"
import { isCalendarDate } from "@/contexts/company/domain/workforce/is-calendar-date"

export function isValidCompanyResourceQuery(query: CompanyResourceQuery): boolean {
  return (
    isCompanyIdentifier(query.organizationId) &&
    query.types.length >= 1 &&
    query.types.length <= 100 &&
    new Set(query.types).size === query.types.length &&
    (query.ids === undefined ||
      (query.ids.length >= 1 &&
        query.ids.length <= 100 &&
        new Set(query.ids).size === query.ids.length &&
        query.ids.every(isCompanyIdentifier))) &&
    (query.effectiveOn === undefined || isCalendarDate(query.effectiveOn))
  )
}

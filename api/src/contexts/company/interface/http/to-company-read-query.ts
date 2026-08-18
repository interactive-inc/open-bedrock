import type { CompanyResourceQuery } from "@/contexts/company/application/core/company-resource-persistence"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import { companyReadHeaderSchema } from "@/contexts/company/interface/http/company-read-header-schema"
import { companyReadQuerySchema } from "@/contexts/company/interface/http/company-read-query-schema"
import type { z } from "zod"

export function toCompanyReadQuery(
  headers: z.infer<typeof companyReadHeaderSchema>,
  query: z.infer<typeof companyReadQuerySchema>,
): Omit<CompanyResourceQuery, "types"> {
  const ids = query.id === undefined ? [] : Array.isArray(query.id) ? query.id : [query.id]
  const effectiveOn = query.effective_on ?? query.as_of
  return {
    organizationId: headers["x-company-organization-id"],
    ...(ids.length === 0 ? {} : { ids }),
    ...(effectiveOn === undefined ? {} : { effectiveOn: restoreCalendarDate(effectiveOn) }),
  }
}

import type {
  CompanyJsonObject,
  CompanyResource,
} from "@/contexts/company/domain/core/company-resource"
import { isCompanyResourceType } from "@/contexts/company/domain/core/is-company-resource-type"
import { validateCompanyResource } from "@/contexts/company/domain/core/validate-company-resource"
import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import type { CompanyResourceRow } from "@/contexts/company/infrastructure/core/company-resource-row.repository"

export function toCompanyResource(row: CompanyResourceRow): CompanyResource | Error {
  if (!isCompanyResourceType(row.resource_type)) return new Error("Unknown Company resource type")
  if (row.state !== "active" && row.state !== "void") return new Error("Invalid Company state")

  let attributes: unknown
  try {
    attributes = JSON.parse(row.attributes_json)
  } catch (cause) {
    return new Error("Invalid Company attributes", { cause })
  }
  if (attributes === null || typeof attributes !== "object" || Array.isArray(attributes)) {
    return new Error("Invalid Company attributes")
  }

  const resource: CompanyResource = {
    organizationId: row.organization_id,
    type: row.resource_type,
    id: row.resource_id,
    revision: row.revision,
    state: row.state,
    effectiveFrom: row.effective_from as CalendarDate,
    effectiveTo: row.effective_to as CalendarDate | null,
    attributes: attributes as CompanyJsonObject,
  }
  return validateCompanyResource(resource) ?? resource
}

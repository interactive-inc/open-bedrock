import { canAccessCompanyOrganization } from "@/contexts/company/application/core/can-access-company-organization"
import type { CompanyActor } from "@/contexts/company/application/core/company-actor"
import type {
  CompanyResourceQuery,
  ReadCompanyResourcePersistence,
} from "@/contexts/company/application/core/company-resource-persistence"
import { hasCompanyCapability } from "@/contexts/company/application/core/has-company-capability"
import { isValidCompanyResourceQuery } from "@/contexts/company/application/core/is-valid-company-resource-query"
import { CompanyResourceValidationError } from "@/contexts/company/domain/core/company-resource-validation-error"
import type { CompanyResource } from "@/contexts/company/domain/core/company-resource"

export type ReadCompanyResourcesResult =
  | Readonly<{
      kind: "found"
      organizationRevision: number
      resources: ReadonlyArray<CompanyResource>
    }>
  | Readonly<{ kind: "invalid"; error: CompanyResourceValidationError }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

export async function readCompanyResources(
  actor: CompanyActor,
  query: CompanyResourceQuery,
  read: ReadCompanyResourcePersistence,
): Promise<ReadCompanyResourcesResult> {
  if (!isValidCompanyResourceQuery(query)) {
    return { kind: "invalid", error: new CompanyResourceValidationError("invalid_query") }
  }
  if (
    !canAccessCompanyOrganization(actor, query.organizationId) ||
    !hasCompanyCapability(actor, "company:read")
  ) {
    return { kind: "forbidden" }
  }

  try {
    const result = await read(query)
    return result.ok
      ? {
          kind: "found",
          organizationRevision: result.organizationRevision,
          resources: result.resources,
        }
      : { kind: "unavailable", cause: result.cause }
  } catch (cause) {
    return { kind: "unavailable", cause }
  }
}

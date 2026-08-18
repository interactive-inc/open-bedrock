import type { CompanyActor } from "@/contexts/company/application/core/company-actor"
import type {
  CompanyResourceQuery,
  ReadCompanyResourcePersistence,
} from "@/contexts/company/application/core/company-resource-persistence"
import {
  readCompanyResources,
  type ReadCompanyResourcesResult,
} from "@/contexts/company/application/core/read-company-resources"

export function readAccountEmployeeLinks(
  actor: CompanyActor,
  query: Omit<CompanyResourceQuery, "types">,
  read: ReadCompanyResourcePersistence,
): Promise<ReadCompanyResourcesResult> {
  return readCompanyResources(actor, { ...query, types: ["account-employee-link"] }, read)
}

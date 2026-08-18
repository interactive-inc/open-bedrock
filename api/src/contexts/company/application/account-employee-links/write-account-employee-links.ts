import type { CompanyActor } from "@/contexts/company/application/core/company-actor"
import type { WriteCompanyResourcePersistence } from "@/contexts/company/application/core/company-resource-persistence"
import {
  writeCompanyResources,
  type WriteCompanyResourcesResult,
} from "@/contexts/company/application/core/write-company-resources"
import type { CompanyResourceChange } from "@/contexts/company/domain/core/company-resource"

export function writeAccountEmployeeLinks(
  actor: CompanyActor,
  change: Omit<CompanyResourceChange, "actorAccountId">,
  write: WriteCompanyResourcePersistence,
): Promise<WriteCompanyResourcesResult> {
  return writeCompanyResources(actor, change, ["account-employee-link"], write)
}

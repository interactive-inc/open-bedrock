import type { CompanyActor } from "@/contexts/company/application/core/company-actor"

export function canAccessCompanyOrganization(actor: CompanyActor, organizationId: string): boolean {
  return actor.organizationIds.includes(organizationId) || actor.organizationIds.includes("*")
}

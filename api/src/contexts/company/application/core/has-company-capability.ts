import type {
  CompanyActor,
  CompanyCapability,
} from "@/contexts/company/application/core/company-actor"

export function hasCompanyCapability(actor: CompanyActor, capability: CompanyCapability): boolean {
  return actor.capabilities.includes("company:admin") || actor.capabilities.includes(capability)
}

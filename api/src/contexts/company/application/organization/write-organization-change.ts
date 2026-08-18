import type { CompanyActor } from "@/contexts/company/application/core/company-actor"
import { canAccessCompanyOrganization } from "@/contexts/company/application/core/can-access-company-organization"
import { hasCompanyCapability } from "@/contexts/company/application/core/has-company-capability"
import type {
  ReadCompanyResourcePersistence,
  WriteCompanyResourcePersistence,
} from "@/contexts/company/application/core/company-resource-persistence"
import {
  writeCompanyResources,
  type WriteCompanyResourcesResult,
} from "@/contexts/company/application/core/write-company-resources"
import type { CompanyResourceChange } from "@/contexts/company/domain/core/company-resource"
import { validateCompanyOrganizationChange } from "@/contexts/company/domain/core/validate-company-organization-change"
import { validateCompanyResourceChange } from "@/contexts/company/domain/core/validate-company-resource-change"

export async function writeOrganizationChange(
  actor: CompanyActor,
  change: Omit<CompanyResourceChange, "actorAccountId">,
  read: ReadCompanyResourcePersistence,
  write: WriteCompanyResourcePersistence,
): Promise<WriteCompanyResourcesResult> {
  const organizationResourceTypes = [
    "organization-unit",
    "assignment",
    "reporting-relation",
    "organizational-authority",
  ] as const
  const organizationId = change.resources[0]?.organizationId ?? ""
  const command = { ...change, actorAccountId: actor.accountId }
  const genericError = validateCompanyResourceChange(command)
  if (genericError !== null) return { kind: "invalid", error: genericError }
  if (
    !canAccessCompanyOrganization(actor, organizationId) ||
    !hasCompanyCapability(actor, "company:write")
  ) {
    return { kind: "forbidden" }
  }

  let current
  try {
    current = await read({ organizationId, types: organizationResourceTypes })
  } catch (cause) {
    return { kind: "unavailable", cause }
  }
  if (!current.ok) return { kind: "unavailable", cause: current.cause }
  if (current.organizationRevision !== change.expectedRevision) {
    return { kind: "conflict", actualRevision: current.organizationRevision }
  }
  const organizationError = validateCompanyOrganizationChange(current.resources, command)
  if (organizationError !== null) return { kind: "invalid", error: organizationError }

  return writeCompanyResources(actor, change, write)
}

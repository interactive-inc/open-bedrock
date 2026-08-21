import type { CompanyActor } from "@/contexts/company/domain/core/company-actor"
import { canAccessCompanyOrganization } from "@/contexts/company/domain/core/can-access-company-organization"
import { hasCompanyCapability } from "@/contexts/company/domain/core/has-company-capability"
import type {
  ReadCompanyResourcePersistence,
  WriteCompanyResourcePersistence,
} from "@/contexts/company/infrastructure/core/company-resource-port.repository"
import {
  WriteCompanyResources,
  type WriteCompanyResourcesResult,
} from "@/contexts/company/application/core/write-company-resources"
import type { CompanyResourceChange } from "@/contexts/company/domain/core/company-resource"
import { validateCompanyOrganizationChange } from "@/contexts/company/domain/core/validate-company-organization-change"
import { validateCompanyResourceChange } from "@/contexts/company/domain/core/validate-company-resource-change"

export class WriteOrganizationChange {
  constructor(
    private readonly actor: CompanyActor,
    private readonly read: ReadCompanyResourcePersistence,
    private readonly write: WriteCompanyResourcePersistence,
  ) {
    Object.freeze(this)
  }

  async execute(
    change: Omit<CompanyResourceChange, "actorAccountId">,
  ): Promise<WriteCompanyResourcesResult> {
    const organizationResourceTypes = [
      "organization-unit",
      "assignment",
      "reporting-relation",
      "organizational-authority",
    ] as const
    const organizationId = change.resources[0]?.organizationId ?? ""
    const command = { ...change, actorAccountId: this.actor.accountId }
    const genericError = validateCompanyResourceChange(command)
    if (genericError !== null) return { kind: "invalid", error: genericError }
    if (
      !canAccessCompanyOrganization(this.actor, organizationId) ||
      !hasCompanyCapability(this.actor, "company:write")
    ) {
      return { kind: "forbidden" }
    }

    let current
    try {
      current = await this.read({ organizationId, types: organizationResourceTypes })
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
    if (!current.ok) return { kind: "unavailable", cause: current.cause }
    if (current.organizationRevision !== change.expectedRevision) {
      return { kind: "conflict", actualRevision: current.organizationRevision }
    }
    const organizationError = validateCompanyOrganizationChange(current.resources, command)
    if (organizationError !== null) return { kind: "invalid", error: organizationError }

    return new WriteCompanyResources(this.actor, this.write).execute(change)
  }
}

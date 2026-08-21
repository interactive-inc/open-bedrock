import { canAccessCompanyOrganization } from "@/contexts/company/domain/core/can-access-company-organization"
import type { CompanyActor } from "@/contexts/company/domain/core/company-actor"
import type {
  CompanyResourceWriteResult,
  WriteCompanyResourcePersistence,
} from "@/contexts/company/infrastructure/core/company-resource-port.repository"
import { hasCompanyCapability } from "@/contexts/company/domain/core/has-company-capability"
import { CompanyResourceValidationError } from "@/contexts/company/domain/core/company-resource-validation-error"
import { validateCompanyResourceChange } from "@/contexts/company/domain/core/validate-company-resource-change"
import type { CompanyResourceChange } from "@/contexts/company/domain/core/company-resource"

export type WriteCompanyResourcesResult =
  | CompanyResourceWriteResult
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "invalid"; error: CompanyResourceValidationError }>

export class WriteCompanyResources {
  constructor(
    private readonly actor: CompanyActor,
    private readonly write: WriteCompanyResourcePersistence,
  ) {
    Object.freeze(this)
  }

  async execute(
    change: Omit<CompanyResourceChange, "actorAccountId">,
  ): Promise<WriteCompanyResourcesResult> {
    const organizationId = change.resources[0]?.organizationId ?? ""
    if (
      !canAccessCompanyOrganization(this.actor, organizationId) ||
      !hasCompanyCapability(this.actor, "company:write")
    ) {
      return { kind: "forbidden" }
    }

    const command: CompanyResourceChange = {
      ...change,
      actorAccountId: this.actor.accountId,
    }
    const error = validateCompanyResourceChange(command)
    if (error !== null) {
      return {
        kind: "invalid",
        error,
      }
    }

    try {
      return await this.write(command)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
  }
}

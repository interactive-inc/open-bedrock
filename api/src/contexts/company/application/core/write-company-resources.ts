import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import {
  CompanyResourceChangeEntity,
  type CompanyResourceChangeProps,
} from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type {
  CompanyResourceRepository,
  CompanyResourceWriteResult,
} from "@/contexts/company/infrastructure/core/company-resource.repository"

export type WriteCompanyResourcesResult =
  | CompanyResourceWriteResult
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "invalid"; error: CompanyResourceValidationError }>

/** Domain policyを通過したCompany resource変更だけを永続化する。 */
export class WriteCompanyResources {
  constructor(
    private readonly actor: CompanyActorValue,
    private readonly repository: CompanyResourceRepository,
  ) {}

  async execute(
    change: Omit<CompanyResourceChangeProps, "actorAccountId">,
  ): Promise<WriteCompanyResourcesResult> {
    const organizationId = change.resources[0]?.organizationId ?? ""
    if (
      !this.actor.canAccessOrganization(organizationId) ||
      !this.actor.hasCapability("company:write")
    ) {
      return { kind: "forbidden" }
    }

    const command = CompanyResourceChangeEntity.create({
      ...change,
      actorAccountId: this.actor.accountId,
    })
    if (command instanceof CompanyResourceValidationError) {
      return { kind: "invalid", error: command }
    }

    try {
      return await this.repository.write(command)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
  }
}

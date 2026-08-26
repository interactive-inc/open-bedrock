import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import {
  CompanyResourceChangeEntity,
  type CompanyResourceChangeProps,
} from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type {
  CompanyResourceRepository,
  CompanyResourceWriteResult,
} from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"

export type WriteCompanyResourcesResult =
  | CompanyResourceWriteResult
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "invalid"; error: CompanyResourceValidationError }>

type Context = Readonly<{
  actor: CompanyActorValue
  repository: CompanyResourceRepository
}>

/** Domain policyを通過したCompany resource変更だけを永続化する。 */
export class WriteCompanyResources {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    change: Omit<CompanyResourceChangeProps, "actorAccountId">,
  ): Promise<WriteCompanyResourcesResult> {
    const organizationId = change.resources[0]?.organizationId ?? ""
    if (
      !this.c.actor.canAccessOrganization(organizationId) ||
      !this.c.actor.hasCapability("company:write")
    ) {
      return { kind: "forbidden" }
    }

    const command = CompanyResourceChangeEntity.create({
      ...change,
      actorAccountId: this.c.actor.accountId,
    })
    if (command instanceof CompanyResourceValidationError) {
      return { kind: "invalid", error: command }
    }

    try {
      return await this.c.repository.write(command)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
  }
}

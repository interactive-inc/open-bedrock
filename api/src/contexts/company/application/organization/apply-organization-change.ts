import {
  CompanyResourceChangeEntity,
  type CompanyResourceChangeProps,
} from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type {
  D1CompanyResourceRepository,
  CompanyResourceWriteResult,
} from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"

type Result =
  | CompanyResourceWriteResult
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "invalid"; error: CompanyResourceValidationError }>

type Context = Readonly<{
  actor: CompanyActorValue
  repository: Pick<D1CompanyResourceRepository, "writeOrganizationChange">
}>

/** 組織変更を適用する。 */
export class ApplyOrganizationChange {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(change: Omit<CompanyResourceChangeProps, "actorAccountId">): Promise<Result> {
    const organizationId = change.resources[0]?.organizationId ?? ""
    const command = CompanyResourceChangeEntity.create({
      ...change,
      actorAccountId: this.c.actor.accountId,
    })
    if (command instanceof CompanyResourceValidationError) {
      return { kind: "invalid", error: command }
    }
    if (
      !this.c.actor.canAccessOrganization(organizationId) ||
      !this.c.actor.hasCapability("company:write")
    ) {
      return { kind: "forbidden" }
    }

    try {
      return await this.c.repository.writeOrganizationChange(command)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
  }
}

import {
  CompanyResourceChangeEntity,
  type CompanyResourceChangeProps,
} from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { validateCompanyOrganizationChange } from "@/contexts/company/domain/policies/company-organization.policy"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type {
  CompanyResourceRepository,
  CompanyResourceWriteResult,
} from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"

type Result =
  | CompanyResourceWriteResult
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "invalid"; error: CompanyResourceValidationError }>

type Context = Readonly<{
  actor: CompanyActorValue
  repository: CompanyResourceRepository
}>

/** 組織変更を適用する。 */
export class ApplyOrganizationChange {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(change: Omit<CompanyResourceChangeProps, "actorAccountId">): Promise<Result> {
    const organizationResourceTypes = [
      "legal-entity",
      "site",
      "workplace",
      "employee",
      "employment",
      "organization-unit",
      "assignment",
      "reporting-relation",
      "position",
      "organizational-office",
      "office-assignment",
      "responsibility",
      "authority-scope",
      "responsibility-assignment",
      "collective-body",
      "collective-body-membership",
      "organizational-authority",
    ] as const
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

    let current
    try {
      current = await this.c.repository.read({ organizationId, types: organizationResourceTypes })
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
    if (!current.ok) return { kind: "unavailable", cause: current.cause }
    if (current.organizationRevision !== change.expectedRevision) {
      return { kind: "conflict", actualRevision: current.organizationRevision }
    }
    const organizationError = validateCompanyOrganizationChange(current.resources, command)
    if (organizationError !== null) return { kind: "invalid", error: organizationError }

    try {
      return await this.c.repository.write(command)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
  }
}

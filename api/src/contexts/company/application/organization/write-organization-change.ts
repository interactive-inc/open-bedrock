import type { WriteCompanyResourcesResult } from "@/contexts/company/application/core/write-company-resources"
import {
  CompanyResourceChangeEntity,
  type CompanyResourceChangeProps,
} from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { validateCompanyOrganizationChange } from "@/contexts/company/domain/policies/company-organization.policy"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { CompanyResourceRepository } from "@/contexts/company/infrastructure/core/company-resource.repository"

/** 組織snapshot全体の不変条件を検証してから変更を永続化する。 */
export class WriteOrganizationChange {
  constructor(
    private readonly actor: CompanyActorValue,
    private readonly repository: CompanyResourceRepository,
  ) {}

  async execute(
    change: Omit<CompanyResourceChangeProps, "actorAccountId">,
  ): Promise<WriteCompanyResourcesResult> {
    const organizationResourceTypes = [
      "organization-unit",
      "assignment",
      "reporting-relation",
      "organizational-authority",
    ] as const
    const organizationId = change.resources[0]?.organizationId ?? ""
    const command = CompanyResourceChangeEntity.create({
      ...change,
      actorAccountId: this.actor.accountId,
    })
    if (command instanceof CompanyResourceValidationError) {
      return { kind: "invalid", error: command }
    }
    if (
      !this.actor.canAccessOrganization(organizationId) ||
      !this.actor.hasCapability("company:write")
    ) {
      return { kind: "forbidden" }
    }

    let current
    try {
      current = await this.repository.read({ organizationId, types: organizationResourceTypes })
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
      return await this.repository.write(command)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
  }
}

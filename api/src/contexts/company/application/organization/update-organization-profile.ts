import { OrganizationProfileValue } from "@/contexts/company/domain/values/organization-profile.value"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { OrganizationProfileRepository } from "@/contexts/company/infrastructure/adapters/organization/d1-organization-profile.adapter"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"

type Context = Readonly<{
  actor: CompanyActorValue
  organizationId: string
  repository: OrganizationProfileRepository
}>

/** 組織プロフィールを更新する。 */
export class UpdateOrganizationProfile {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    value: Readonly<{ name: string; representativeName: string }>,
  ): Promise<OrganizationProfileValue | Error> {
    if (!this.c.actor.hasCapability("company:write")) {
      return new CompanyForbiddenError()
    }
    const profile = OrganizationProfileValue.create(value)
    if (profile instanceof Error) return profile
    const written = await this.c.repository.save(this.c.organizationId, profile)
    return written instanceof Error ? written : profile
  }
}

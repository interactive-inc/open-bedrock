import type { CompanyActor } from "@/contexts/company/domain/core/company-actor"
import { hasCompanyCapability } from "@/contexts/company/domain/core/has-company-capability"
import { OrganizationProfileEntity } from "@/contexts/company/domain/organization/organization-profile.entity"
import { ApplicationForbiddenError } from "@/lib/errors/application-error"

export class UpdateOrganizationProfile {
  constructor(
    private readonly actor: CompanyActor,
    private readonly write: (profile: OrganizationProfileEntity) => Promise<void | Error>,
  ) {
    Object.freeze(this)
  }

  async execute(
    value: Readonly<{ name: string; representativeName: string }>,
  ): Promise<OrganizationProfileEntity | Error> {
    if (!hasCompanyCapability(this.actor, "company:write")) {
      return new ApplicationForbiddenError()
    }
    const profile = OrganizationProfileEntity.create(value)
    if (profile instanceof Error) return profile
    const written = await this.write(profile)
    return written instanceof Error ? written : profile
  }
}

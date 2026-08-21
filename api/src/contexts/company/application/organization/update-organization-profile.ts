import { OrganizationProfileValue } from "@/contexts/company/domain/values/organization-profile.value"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { OrganizationProfileRepository } from "@/contexts/company/infrastructure/organization/organization-profile.repository"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"

/** Domain entityを生成できる組織プロフィールだけを永続化する。 */
export class UpdateOrganizationProfile {
  constructor(
    private readonly actor: CompanyActorValue,
    private readonly organizationId: string,
    private readonly repository: OrganizationProfileRepository,
  ) {}

  async execute(
    value: Readonly<{ name: string; representativeName: string }>,
  ): Promise<OrganizationProfileValue | Error> {
    if (!this.actor.hasCapability("company:write")) {
      return new CompanyForbiddenError()
    }
    const profile = OrganizationProfileValue.create(value)
    if (profile instanceof Error) return profile
    const written = await this.repository.save(this.organizationId, profile)
    return written instanceof Error ? written : profile
  }
}

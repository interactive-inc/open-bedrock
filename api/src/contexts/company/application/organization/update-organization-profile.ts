import type { CompanyActor } from "@/contexts/company/application/core/company-actor"
import { hasCompanyCapability } from "@/contexts/company/application/core/has-company-capability"
import { OrganizationProfileEntity } from "@/contexts/company/domain/organization/organization-profile.entity"
import { ApplicationForbiddenError } from "@/lib/errors/application-error"

export async function updateOrganizationProfile(
  actor: CompanyActor,
  value: Readonly<{ name: string; representativeName: string }>,
  write: (profile: OrganizationProfileEntity) => Promise<void | Error>,
): Promise<OrganizationProfileEntity | Error> {
  if (!hasCompanyCapability(actor, "company:write")) {
    return new ApplicationForbiddenError()
  }
  const profile = OrganizationProfileEntity.create(value)
  if (profile instanceof Error) return profile
  const written = await write(profile)
  return written instanceof Error ? written : profile
}

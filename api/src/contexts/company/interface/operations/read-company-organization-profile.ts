import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { OrganizationProfileVersion } from "@/contexts/company/domain/definitions/organization-profile-version.definition"
import { D1OrganizationProfileAdapter } from "@/contexts/company/infrastructure/adapters/organization/d1-organization-profile.adapter"

export type CompanyOrganizationProfile = Readonly<{
  name: string
  representativeName: string | null
  locale: string | null
  timeZone: string | null
  fiscalYearStartMonth: number | null
  version: OrganizationProfileVersion
}>

/** 確定した法人プロフィールを有効日で読み、内部の旧投影・原文を公開しない。 */
export async function readCompanyOrganizationProfile(
  input: Readonly<{
    database: D1Database
    organizationId: string
    effectiveOn: CalendarDate
  }>,
): Promise<CompanyOrganizationProfile | null | Error> {
  const profile = await new D1OrganizationProfileAdapter(input.database).find(
    input.organizationId,
    input.effectiveOn,
  )
  if (profile === null || profile instanceof Error) return profile
  return {
    name: profile.name,
    representativeName: profile.representativeName,
    locale: profile.props.locale,
    timeZone: profile.props.timeZone,
    fiscalYearStartMonth: profile.props.fiscalYearStartMonth,
    version: profile.props.version,
  }
}

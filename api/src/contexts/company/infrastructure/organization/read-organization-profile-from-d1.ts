import { OrganizationProfileEntity } from "@/contexts/company/domain/organization/organization-profile.entity"

export async function readOrganizationProfileFromD1(
  database: D1Database,
  organizationId: string,
): Promise<OrganizationProfileEntity | null | Error> {
  try {
    const row = await database
      .prepare(
        `SELECT name, representative_name AS representativeName
         FROM company_organizations
         WHERE id = ?
         LIMIT 1`,
      )
      .bind(organizationId)
      .first<{ name: string; representativeName: string }>()
    if (row === null || (row.name === "" && row.representativeName === "")) return null
    return OrganizationProfileEntity.create(row)
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("organization profile read failed")
  }
}

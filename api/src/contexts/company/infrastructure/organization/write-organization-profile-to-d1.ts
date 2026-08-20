import type { OrganizationProfileEntity } from "@/contexts/company/domain/organization/organization-profile.entity"

export async function writeOrganizationProfileToD1(
  database: D1Database,
  organizationId: string,
  profile: OrganizationProfileEntity,
): Promise<void | Error> {
  try {
    const result = await database
      .prepare(
        `UPDATE company_organizations
         SET name = ?, representative_name = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(profile.name, profile.representativeName, Date.now(), organizationId)
      .run()
    return result.meta.changes === 1 ? undefined : new Error("organization profile does not exist")
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("organization profile write failed")
  }
}

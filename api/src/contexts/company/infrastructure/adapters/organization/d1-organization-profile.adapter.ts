import { OrganizationProfileValue } from "@/contexts/company/domain/values/organization-profile.value"

export type OrganizationProfileRepository = Readonly<{
  find: (organizationId: string) => Promise<OrganizationProfileValue | null | Error>
  save: (organizationId: string, profile: OrganizationProfileValue) => Promise<void | Error>
}>
type D1OrganizationProfileAdapterContext = D1Database
type Context = D1OrganizationProfileAdapterContext

/** company_organizations のプロフィール列を永続化する。 */
export class D1OrganizationProfileAdapter implements OrganizationProfileRepository {
  constructor(private readonly c: Context) {}

  async find(organizationId: string): Promise<OrganizationProfileValue | null | Error> {
    try {
      const row = await this.c
        .prepare(
          `SELECT name, representative_name AS representativeName
           FROM company_organizations
           WHERE id = ?
           LIMIT 1`,
        )
        .bind(organizationId)
        .first<{ name: string; representativeName: string }>()
      if (row === null || (row.name === "" && row.representativeName === "")) return null
      return OrganizationProfileValue.create(row)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("organization profile read failed")
    }
  }

  async save(organizationId: string, profile: OrganizationProfileValue): Promise<void | Error> {
    try {
      const result = await this.c
        .prepare(
          `UPDATE company_organizations
           SET name = ?, representative_name = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(profile.name, profile.representativeName, Date.now(), organizationId)
        .run()
      return result.meta.changes === 1
        ? undefined
        : new Error("organization profile does not exist")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("organization profile write failed")
    }
  }
}

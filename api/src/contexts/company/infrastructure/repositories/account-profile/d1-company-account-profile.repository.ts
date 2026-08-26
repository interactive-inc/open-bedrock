import { CompanyAccountProfileEntity } from "@/contexts/company/domain/entities/company-account-profile.entity"

export type CompanyAccountProfileRepository = Readonly<{
  find: (
    organizationId: string,
    accountId: string,
  ) => Promise<CompanyAccountProfileEntity | null | Error>
  save: (profile: CompanyAccountProfileEntity) => Promise<void | Error>
}>

type CompanyAccountProfileRow = Readonly<{
  organization_id: string
  account_id: string
  display_name: string
  created_at: number
  updated_at: number
}>
type D1CompanyAccountProfileRepositoryContext = D1Database
type Context = D1CompanyAccountProfileRepositoryContext

/** company_account_profilesのD1永続化。 */
export class D1CompanyAccountProfileRepository implements CompanyAccountProfileRepository {
  constructor(private readonly c: Context) {}

  async find(
    organizationId: string,
    accountId: string,
  ): Promise<CompanyAccountProfileEntity | null | Error> {
    try {
      const row = await this.c
        .prepare(
          `SELECT organization_id, account_id, display_name, created_at, updated_at
           FROM company_account_profiles
           WHERE organization_id = ?1 AND account_id = ?2`,
        )
        .bind(organizationId, accountId)
        .first<CompanyAccountProfileRow>()
      if (row === null) return null

      return CompanyAccountProfileEntity.create({
        organizationId: row.organization_id,
        accountId: row.account_id,
        displayName: row.display_name,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read Company Account Profile")
    }
  }

  async save(profile: CompanyAccountProfileEntity): Promise<void | Error> {
    try {
      const result = await this.c
        .prepare(
          `UPDATE company_account_profiles
           SET display_name = ?3, updated_at = ?4
           WHERE organization_id = ?1 AND account_id = ?2`,
        )
        .bind(
          profile.organizationId,
          profile.accountId,
          profile.displayName,
          profile.updatedAt.getTime(),
        )
        .run()
      return result.meta.changes === 1
        ? undefined
        : new Error("Company Account Profile does not exist")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to write Company Account Profile")
    }
  }
}

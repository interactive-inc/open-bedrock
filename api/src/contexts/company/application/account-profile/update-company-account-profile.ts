import type { CompanyAccountProfileEntity } from "@/contexts/company/domain/entities/company-account-profile.entity"
import type { CompanyAccountProfileRepository } from "@/contexts/company/infrastructure/repositories/account-profile/d1-company-account-profile.repository"
type UpdateCompanyAccountProfileContext = CompanyAccountProfileRepository
type Context = UpdateCompanyAccountProfileContext

/** 既存プロフィールだけを更新し、存在しないAccountの暗黙作成を許さない。 */
export class UpdateCompanyAccountProfile {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(organizationId: string, accountId: string, displayName: string, now: Date) {
    const current: CompanyAccountProfileEntity | null | Error = await this.c.find(
      organizationId,
      accountId,
    )
    if (current instanceof Error || current === null) return current

    const updated = current.rename(displayName, now)
    if (updated instanceof Error) return updated

    const saved = await this.c.save(updated)
    return saved instanceof Error ? saved : updated
  }
}

import type { CompanyAccountProfileRepository } from "@/contexts/company/application/account-profile/company-account-profile-repository"

/** 既存プロフィールだけを更新し、存在しないAccountの暗黙作成を許さない。 */
export class UpdateCompanyAccountProfile {
  constructor(private readonly repository: CompanyAccountProfileRepository) {}

  async execute(organizationId: string, accountId: string, displayName: string, now: Date) {
    const current = await this.repository.find(organizationId, accountId)
    if (current instanceof Error || current === null) return current

    const updated = current.rename(displayName, now)
    if (updated instanceof Error) return updated

    const saved = await this.repository.save(updated)
    return saved instanceof Error ? saved : updated
  }
}

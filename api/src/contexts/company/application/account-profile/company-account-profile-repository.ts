import type { CompanyAccountProfileEntity } from "@/contexts/company/domain/account-profile/company-account-profile.entity"

export type CompanyAccountProfileRepository = Readonly<{
  find: (
    organizationId: string,
    accountId: string,
  ) => Promise<CompanyAccountProfileEntity | null | Error>
  save: (profile: CompanyAccountProfileEntity) => Promise<void | Error>
}>

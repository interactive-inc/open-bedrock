import {
  D1CompanyResourceRepository,
  type CompanyResourceWriteResult,
} from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"

export type CompanyResourceStore = D1CompanyResourceRepository

export type CompanyResourceStoreWriteResult = CompanyResourceWriteResult

/** 会社 resource の版付き読み書きを扱う公開境界。 */
export function openCompanyResourceRepository(
  c: ConstructorParameters<typeof D1CompanyResourceRepository>[0],
): CompanyResourceStore {
  return new D1CompanyResourceRepository(c)
}

import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import type { CompanyResourceType } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceHistoryRepository } from "@/contexts/company/infrastructure/repositories/core/company-resource-history.repository"

export type EmploymentStartCorrectionHistory = Readonly<{
  organizationRevision: number
  resources: ReadonlyArray<CompanyResourceProps & Readonly<{ correctsRevision: number | null }>>
}>

/** 同じ会社版に固定して雇用の全revisionを取得する。 */
export async function readEmploymentStartCorrectionHistory(
  input: Readonly<{
    database: D1Database
    organizationId: string
    employmentId: string
    throughRevision?: number
  }>,
): Promise<EmploymentStartCorrectionHistory | null | Error> {
  return readCompanyStartCorrectionHistory({
    ...input,
    type: "employment",
    resourceId: input.employmentId,
  })
}

/** 訂正に使う Person / Employee / Employment の全履歴を同じ会社版に固定する。 */
export async function readCompanyStartCorrectionHistory(
  input: Readonly<{
    database: D1Database
    organizationId: string
    type: CompanyResourceType
    resourceId: string
    throughRevision?: number
  }>,
): Promise<EmploymentStartCorrectionHistory | null | Error> {
  const repository = new CompanyResourceHistoryRepository(input.database)
  const resources: Array<EmploymentStartCorrectionHistory["resources"][number]> = []
  let afterRevision = 0
  let organizationRevision = input.throughRevision
  while (true) {
    const page = await repository.list({
      organizationId: input.organizationId,
      type: input.type,
      id: input.resourceId,
      afterRevision,
      throughRevision: organizationRevision ?? null,
      limit: 100,
    })
    if (page instanceof Error) return page
    organizationRevision = page.throughRevision
    resources.push(
      ...page.data.map(({ change, resource }) => ({
        ...resource,
        correctsRevision: change.corrects_revision,
      })),
    )
    if (!page.hasMore) break
    if (resources.length >= 10_000 || page.nextAfterRevision <= afterRevision)
      return new CompanyResourceValidationError("invalid_resource")
    afterRevision = page.nextAfterRevision
  }
  if (resources.length === 0) return null
  return { organizationRevision: organizationRevision ?? 0, resources }
}

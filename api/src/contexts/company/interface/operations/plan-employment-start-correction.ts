import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { CompanyEmploymentStartCorrectionValue } from "@/contexts/company/domain/values/company-employment-start-correction.value"
import { CompanyResourceHistoryRepository } from "@/contexts/company/infrastructure/repositories/core/company-resource-history.repository"

/** 指定した会社版の全雇用履歴を読み、確認済みの開始revisionに対する追記を計画する。 */
export async function planEmploymentStartCorrection(
  input: Readonly<{
    database: D1Database
    organizationId: string
    employmentId: string
    expectedRevision: number
    correctsRevision: number
    startsOn: CalendarDate
    commandId: string
    recordedAt: number
  }>,
): Promise<CompanyEmploymentStartCorrectionValue | null | Error> {
  const repository = new CompanyResourceHistoryRepository(input.database)
  const history: Array<
    Parameters<typeof CompanyEmploymentStartCorrectionValue.create>[0]["history"][number]
  > = []
  let afterRevision = 0
  while (true) {
    const page = await repository.list({
      organizationId: input.organizationId,
      type: "employment",
      id: input.employmentId,
      afterRevision,
      throughRevision: input.expectedRevision,
      limit: 100,
    })
    if (page instanceof Error) return page
    history.push(
      ...page.data.map(({ change, resource }) => ({
        ...resource,
        correctsRevision: change.corrects_revision,
      })),
    )
    if (!page.hasMore) break
    if (history.length >= 10_000 || page.nextAfterRevision <= afterRevision)
      return new CompanyResourceValidationError("invalid_resource")
    afterRevision = page.nextAfterRevision
  }
  if (history.length === 0) return null
  return CompanyEmploymentStartCorrectionValue.create({
    history,
    correctsRevision: input.correctsRevision,
    startsOn: input.startsOn,
    commandId: input.commandId,
    recordedAt: input.recordedAt,
  })
}

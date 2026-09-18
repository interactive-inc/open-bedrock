import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { CompanyEmploymentStartCorrectionValue } from "@/contexts/company/domain/values/company-employment-start-correction.value"
import { readEmploymentStartCorrectionHistory } from "@/contexts/company/interface/operations/read-employment-start-correction-history"

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
  const history = await readEmploymentStartCorrectionHistory({
    database: input.database,
    organizationId: input.organizationId,
    employmentId: input.employmentId,
    throughRevision: input.expectedRevision,
  })
  if (history === null || history instanceof Error) return history
  return CompanyEmploymentStartCorrectionValue.create({
    history: history.resources,
    correctsRevision: input.correctsRevision,
    startsOn: input.startsOn,
    commandId: input.commandId,
    recordedAt: input.recordedAt,
  })
}

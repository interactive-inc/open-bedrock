import type { YearEndAdjustment } from "@/domain/year-end-adjustment/year-end-adjustment"
import type { Context } from "@/env"
import { YearEndAdjustmentRepository } from "@/infrastructure/year-end-adjustment/year-end-adjustment-repository"

export type Command = {
  yearEndAdjustmentId: string
  employeeId: number
}

export type YearEndAdjustmentNotFound = { reason: "year_end_adjustment_not_found" }

export type NotApplicant = { reason: "not_applicant" }

/**
 * 年末調整の申告を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetYearEndAdjustment {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<YearEndAdjustment | YearEndAdjustmentNotFound | NotApplicant | Error> {
    const yearEndAdjustmentRepository = new YearEndAdjustmentRepository(this.c)

    const yearEndAdjustment = await yearEndAdjustmentRepository.findById(
      command.yearEndAdjustmentId,
    )

    if (yearEndAdjustment instanceof Error) {
      return yearEndAdjustment
    }

    if (yearEndAdjustment === null) {
      return { reason: "year_end_adjustment_not_found" }
    }

    if (yearEndAdjustment.employeeId !== command.employeeId) {
      return { reason: "not_applicant" }
    }

    return yearEndAdjustment
  }
}

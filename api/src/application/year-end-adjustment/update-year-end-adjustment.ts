import type { YearEndAdjustment } from "@/domain/year-end-adjustment/year-end-adjustment"
import type { Context } from "@/env"
import { YearEndAdjustmentRepository } from "@/infrastructure/year-end-adjustment/year-end-adjustment-repository"

export type Command = {
  yearEndAdjustmentId: string
  employeeId: number
  targetYear: number
  note: string | null
}

export type YearEndAdjustmentNotFound = { reason: "year_end_adjustment_not_found" }

export type NotApplicant = { reason: "not_applicant" }

export type NotModifiable = { reason: "not_modifiable" }

/**
 * 年末調整の申告の対象年・備考を変更する。本人以外と、承認済み申告の変更を拒否する。
 */
export class UpdateYearEndAdjustment {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<YearEndAdjustment | YearEndAdjustmentNotFound | NotApplicant | NotModifiable | Error> {
    const yearEndAdjustmentRepository = new YearEndAdjustmentRepository(this.c)

    const current = await yearEndAdjustmentRepository.findById(command.yearEndAdjustmentId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "year_end_adjustment_not_found" }
    }

    if (current.employeeId !== command.employeeId) {
      return { reason: "not_applicant" }
    }

    if (!current.isModifiable) {
      return { reason: "not_modifiable" }
    }

    const updated = current.withDetails({
      targetYear: command.targetYear,
      note: command.note,
    })

    const saved = await yearEndAdjustmentRepository.update(updated)

    if (saved === null) {
      return { reason: "not_modifiable" }
    }

    return saved
  }
}

import type { Context } from "@/env"
import { YearEndAdjustmentRepository } from "@/infrastructure/year-end-adjustment/year-end-adjustment-repository"

export type Command = {
  yearEndAdjustmentId: string
  employeeId: number
}

export type YearEndAdjustmentNotFound = { reason: "year_end_adjustment_not_found" }

export type NotApplicant = { reason: "not_applicant" }

export type NotModifiable = { reason: "not_modifiable" }

export type Cancelled = { reason: "cancelled" }

/**
 * 年末調整の申告を取消する。本人以外と、承認済み申告の取消を拒否する。
 */
export class CancelYearEndAdjustment {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Cancelled | YearEndAdjustmentNotFound | NotApplicant | NotModifiable | Error> {
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

    const deleted = await yearEndAdjustmentRepository.delete(command.yearEndAdjustmentId)

    if (deleted instanceof Error) {
      return deleted
    }

    if (deleted === null) {
      return { reason: "not_modifiable" }
    }

    return { reason: "cancelled" }
  }
}

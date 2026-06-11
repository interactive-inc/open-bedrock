import { YearEndAdjustment } from "@/domain/year-end-adjustment/year-end-adjustment"
import type { Context } from "@/env"
import { YearEndAdjustmentRepository } from "@/infrastructure/year-end-adjustment/year-end-adjustment-repository"

export type Command = {
  employeeId: number
  targetYear: number
  note: string | null
  createdAt: string
}

export type AlreadySubmitted = { kind: "already_submitted" }

/**
 * 年末調整の申告を作成する。status は "submitted" で登録する。
 */
export class CreateYearEndAdjustment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<YearEndAdjustment | AlreadySubmitted | Error> {
    const yearEndAdjustmentRepository = new YearEndAdjustmentRepository(this.c)

    const existing = await yearEndAdjustmentRepository.findByEmployeeIdAndYear(
      command.employeeId,
      command.targetYear,
    )
    if (existing instanceof Error) return existing
    if (existing !== null) return { kind: "already_submitted" }

    const yearEndAdjustment = YearEndAdjustment.create({
      employeeId: command.employeeId,
      targetYear: command.targetYear,
      note: command.note,
      createdAt: command.createdAt,
    })

    const result = await yearEndAdjustmentRepository.create(yearEndAdjustment)

    // UNIQUE 制約違反（並行リクエストによる二重登録）は already_submitted として扱う。
    if (result === null) return { kind: "already_submitted" }

    return result
  }
}

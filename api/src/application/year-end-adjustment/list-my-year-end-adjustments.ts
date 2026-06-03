import type { YearEndAdjustment } from "@/domain/year-end-adjustment/year-end-adjustment"
import type { Context } from "@/env"
import { YearEndAdjustmentRepository } from "@/infrastructure/year-end-adjustment/year-end-adjustment-repository"

export type Command = {
  employeeId: number
}

/**
 * 本人の年末調整の申告を一覧する。
 */
export class ListMyYearEndAdjustments {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<YearEndAdjustment> | Error> {
    const yearEndAdjustmentRepository = new YearEndAdjustmentRepository(this.c)

    return await yearEndAdjustmentRepository.findByEmployeeId(command.employeeId)
  }
}

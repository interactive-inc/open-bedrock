import { FamilyCareLeave } from "@/domain/family-care-leave/family-care-leave.entity"
import type { Context } from "@/env"
import { FamilyCareLeaveRepository } from "@/infrastructure/family-care-leave/family-care-leave-repository"

export type Command = {
  employeeId: number
  leaveKind: string
  startDate: string
  endDate: string
  note: string | null
  createdAt: string
}

export type InvalidDateRange = { reason: "invalid_date_range" }

export type OverlappingLeave = { reason: "overlapping_leave" }

/**
 * 休業申出を作成する。status は "requested" で登録する。
 */
export class CreateFamilyCareLeave {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<FamilyCareLeave | InvalidDateRange | OverlappingLeave | Error> {
    const familyCareLeaveRepository = new FamilyCareLeaveRepository(this.c)

    const familyCareLeave = FamilyCareLeave.create({
      employeeId: command.employeeId,
      leaveKind: command.leaveKind,
      startDate: command.startDate,
      endDate: command.endDate,
      note: command.note,
      createdAt: command.createdAt,
    })

    if ("reason" in familyCareLeave) {
      return familyCareLeave
    }

    const created = await familyCareLeaveRepository.create(familyCareLeave)

    if (created instanceof Error) {
      return created
    }

    // 条件付き INSERT が 0 行だった場合は並行リクエストによる期間重複。
    if (created === null) {
      return { reason: "overlapping_leave" }
    }

    return created
  }
}

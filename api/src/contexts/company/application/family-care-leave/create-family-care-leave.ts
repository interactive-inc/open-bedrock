import { FamilyCareLeave } from "@/contexts/company/domain/family-care-leave/family-care-leave.entity"
import { ConflictError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { FamilyCareLeaveRepository } from "@/contexts/company/infrastructure/family-care-leave/family-care-leave-repository"

export type Command = {
  employeeId: number
  leaveKind: string
  startDate: string
  endDate: string
  note: string | null
  createdAt: string
}

/**
 * 休業申出を作成する。status は "requested" で登録する。
 */
export class CreateFamilyCareLeave {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<FamilyCareLeave | ApplicationError> {
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
      return new ValidationError("invalid date range", "invalid_date_range")
    }

    const created = await familyCareLeaveRepository.create(familyCareLeave)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create family care leave", { cause: created })
    }

    // 条件付き INSERT が 0 行だった場合は並行リクエストによる期間重複。
    if (created === null) {
      return new ConflictError("休業期間が既存の申出と重複しています", "overlapping_leave")
    }

    return created
  }
}

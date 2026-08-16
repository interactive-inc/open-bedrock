import type { FamilyCareLeave } from "@/contexts/family-care-leave/domain/family-care-leave.entity"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { FamilyCareLeaveRepository } from "@/contexts/family-care-leave/infrastructure/family-care-leave-repository"

export type Command = {
  familyCareLeaveId: string
  employeeId: number
  leaveKind: string
  startDate: string
  endDate: string
  note: string | null
}

/**
 * 休業申出の種別・期間・備考を変更する。本人以外と、承認済み申出の変更を拒否する。
 */
export class UpdateFamilyCareLeave {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<FamilyCareLeave | ApplicationError> {
    const familyCareLeaveRepository = new FamilyCareLeaveRepository(this.c)

    const current = await familyCareLeaveRepository.findById(command.familyCareLeaveId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find family care leave", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("family care leave not found", "family_care_leave_not_found")
    }

    if (current.employeeId !== command.employeeId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    if (current.status !== "requested") {
      return new ConflictError("family care leave not modifiable", "not_modifiable")
    }

    const updated = current.withDetails({
      leaveKind: command.leaveKind,
      startDate: command.startDate,
      endDate: command.endDate,
      note: command.note,
    })

    if ("reason" in updated) {
      return new ValidationError("invalid date range", "invalid_date_range")
    }

    // 自身を除く同一社員・重複期間の requested 申出があれば 0 行更新となり null を返す。
    // チェックと UPDATE をアトミックに行い、並行リクエストによる二重申出を防ぐ。
    const saved = await familyCareLeaveRepository.updateIfNoOverlap(updated)

    if (saved instanceof Error) {
      return new UnexpectedError("failed to update family care leave", { cause: saved })
    }

    // 0 行更新の理由（消失 / status 変更 / 重複）を再取得して判別する。
    if (saved === null) {
      const latest = await familyCareLeaveRepository.findById(command.familyCareLeaveId)

      if (latest instanceof Error) {
        return new UnexpectedError("failed to find family care leave", { cause: latest })
      }

      if (latest === null) {
        return new NotFoundError("family care leave not found", "family_care_leave_not_found")
      }

      if (latest.status !== "requested") {
        return new ConflictError("family care leave not modifiable", "not_modifiable")
      }

      return new ConflictError("休業期間が既存の申出と重複しています", "overlapping_leave")
    }

    return saved
  }
}

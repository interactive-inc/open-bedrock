import type { FamilyCareLeave } from "@/domain/family-care-leave/family-care-leave"
import type { Context } from "@/env"
import { FamilyCareLeaveRepository } from "@/infrastructure/family-care-leave/family-care-leave-repository"

export type Command = {
  familyCareLeaveId: string
  employeeId: number
  leaveKind: string
  startDate: string
  endDate: string
  note: string | null
}

export type FamilyCareLeaveNotFound = { reason: "family_care_leave_not_found" }

export type NotApplicant = { reason: "not_applicant" }

export type NotModifiable = { reason: "not_modifiable" }

export type InvalidDateRange = { reason: "invalid_date_range" }

export type OverlappingLeave = { reason: "overlapping_leave" }

/**
 * 休業申出の種別・期間・備考を変更する。本人以外と、承認済み申出の変更を拒否する。
 */
export class UpdateFamilyCareLeave {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<
    | FamilyCareLeave
    | FamilyCareLeaveNotFound
    | NotApplicant
    | NotModifiable
    | InvalidDateRange
    | OverlappingLeave
    | Error
  > {
    const familyCareLeaveRepository = new FamilyCareLeaveRepository(this.c)

    const current = await familyCareLeaveRepository.findById(command.familyCareLeaveId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "family_care_leave_not_found" }
    }

    if (current.employeeId !== command.employeeId) {
      return { reason: "not_applicant" }
    }

    if (current.status !== "requested") {
      return { reason: "not_modifiable" }
    }

    const updated = current.withDetails({
      leaveKind: command.leaveKind,
      startDate: command.startDate,
      endDate: command.endDate,
      note: command.note,
    })

    if ("reason" in updated) {
      return updated
    }

    // 自身を除く同一社員・重複期間の requested 申出があれば 0 行更新となり null を返す。
    // チェックと UPDATE をアトミックに行い、並行リクエストによる二重申出を防ぐ。
    const saved = await familyCareLeaveRepository.updateIfNoOverlap(updated)

    if (saved instanceof Error) {
      return saved
    }

    // 0 行更新の理由（消失 / status 変更 / 重複）を再取得して判別する。
    if (saved === null) {
      const latest = await familyCareLeaveRepository.findById(command.familyCareLeaveId)

      if (latest instanceof Error) {
        return latest
      }

      if (latest === null) {
        return { reason: "family_care_leave_not_found" }
      }

      if (latest.status !== "requested") {
        return { reason: "not_modifiable" }
      }

      return { reason: "overlapping_leave" }
    }

    return saved
  }
}

import type { FamilyCareLeave } from "@/domain/family-care-leave/family-care-leave.entity"
import type { Context } from "@/env"
import { FamilyCareLeaveRepository } from "@/infrastructure/family-care-leave/family-care-leave-repository"

export type Command = {
  familyCareLeaveId: string
  employeeId: number
}

export type FamilyCareLeaveNotFound = { reason: "family_care_leave_not_found" }

export type NotApplicant = { reason: "not_applicant" }

/**
 * 休業申出を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetFamilyCareLeave {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<FamilyCareLeave | FamilyCareLeaveNotFound | NotApplicant | Error> {
    const familyCareLeaveRepository = new FamilyCareLeaveRepository(this.c)

    const familyCareLeave = await familyCareLeaveRepository.findById(command.familyCareLeaveId)

    if (familyCareLeave instanceof Error) {
      return familyCareLeave
    }

    if (familyCareLeave === null) {
      return { reason: "family_care_leave_not_found" }
    }

    if (familyCareLeave.employeeId !== command.employeeId) {
      return { reason: "not_applicant" }
    }

    return familyCareLeave
  }
}

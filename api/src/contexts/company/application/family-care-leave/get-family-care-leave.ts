import type { FamilyCareLeave } from "@/domain/family-care-leave/family-care-leave.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { FamilyCareLeaveRepository } from "@/infrastructure/family-care-leave/family-care-leave-repository"

export type Command = {
  familyCareLeaveId: string
  employeeId: number
}

/**
 * 休業申出を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetFamilyCareLeave {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<FamilyCareLeave | ApplicationError> {
    const familyCareLeaveRepository = new FamilyCareLeaveRepository(this.c)

    const familyCareLeave = await familyCareLeaveRepository.findById(command.familyCareLeaveId)

    if (familyCareLeave instanceof Error) {
      return new UnexpectedError("failed to find family care leave", { cause: familyCareLeave })
    }

    if (familyCareLeave === null) {
      return new NotFoundError("family care leave not found", "family_care_leave_not_found")
    }

    if (familyCareLeave.employeeId !== command.employeeId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    return familyCareLeave
  }
}

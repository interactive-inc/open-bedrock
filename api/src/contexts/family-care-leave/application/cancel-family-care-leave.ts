import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { FamilyCareLeaveRepository } from "@/contexts/family-care-leave/infrastructure/family-care-leave-repository"

export type Command = {
  familyCareLeaveId: string
  employeeId: number
}

export type Cancelled = { reason: "cancelled" }

/**
 * 休業申出を取消する。本人以外と、承認済み申出の取消を拒否する。
 */
export class CancelFamilyCareLeave {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | ApplicationError> {
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

    const deleted = await familyCareLeaveRepository.delete(command.familyCareLeaveId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete family care leave", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("family care leave not modifiable", "not_modifiable")
    }

    return { reason: "cancelled" }
  }
}

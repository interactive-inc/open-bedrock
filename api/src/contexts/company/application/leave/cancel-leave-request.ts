import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { LeaveRequestRepository } from "@/infrastructure/leave/leave-request-repository"

export type Command = {
  leaveRequestId: number
  employeeId: number
}

export type Cancelled = { reason: "cancelled" }

/**
 * 休暇申請を取り下げる。本人以外と、決定済み申請の取り下げを拒否する。
 */
export class CancelLeaveRequest {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | ApplicationError> {
    const repository = new LeaveRequestRepository(this.c)

    const current = await repository.findById(command.leaveRequestId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find leave request", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("leave request not found", "leave_request_not_found")
    }

    if (current.employeeId !== command.employeeId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    if (current.isModifiable === false) {
      return new ConflictError("the leave request is already decided", "not_modifiable")
    }

    const deleted = await repository.delete(command.leaveRequestId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete leave request", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("the leave request is already decided", "not_modifiable")
    }

    return { reason: "cancelled" }
  }
}

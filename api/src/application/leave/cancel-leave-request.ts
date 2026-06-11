import type { Context } from "@/env"
import { LeaveRequestRepository } from "@/infrastructure/leave/leave-request-repository"

export type Command = {
  leaveRequestId: number
  employeeId: number
}

export type LeaveRequestNotFound = { reason: "leave_request_not_found" }

export type NotApplicant = { reason: "not_applicant" }

export type NotModifiable = { reason: "not_modifiable" }

export type Cancelled = { reason: "cancelled" }

type Result = Cancelled | LeaveRequestNotFound | NotApplicant | NotModifiable

/**
 * 休暇申請を取り下げる。本人以外と、決定済み申請の取り下げを拒否する。
 */
export class CancelLeaveRequest {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Result | Error> {
    const repository = new LeaveRequestRepository(this.c)

    const current = await repository.findById(command.leaveRequestId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "leave_request_not_found" }
    }

    if (current.employeeId !== command.employeeId) {
      return { reason: "not_applicant" }
    }

    if (current.isModifiable === false) {
      return { reason: "not_modifiable" }
    }

    const deleted = await repository.delete(command.leaveRequestId)

    if (deleted instanceof Error) {
      return deleted
    }

    if (deleted === null) {
      return { reason: "not_modifiable" }
    }

    return { reason: "cancelled" }
  }
}

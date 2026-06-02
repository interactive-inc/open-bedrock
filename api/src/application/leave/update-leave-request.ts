import type { LeaveRequest } from "@/domain/leave/leave-request"
import { toLeaveDays } from "@/domain/leave/to-leave-days"
import type { Context } from "@/env"
import { LeaveRequestRepository } from "@/infrastructure/leave/leave-request-repository"

export type Command = {
  leaveRequestId: number
  employeeId: number
  leaveType: "annual" | "special"
  startDate: string
  endDate: string
  reason: string | null
}

export type LeaveRequestNotFound = { reason: "leave_request_not_found" }

export type NotApplicant = { reason: "not_applicant" }

export type NotModifiable = { reason: "not_modifiable" }

export type InvalidLeavePeriod = { reason: "invalid_leave_period" }

type Failure = LeaveRequestNotFound | NotApplicant | NotModifiable | InvalidLeavePeriod

/**
 * 休暇申請の内容を変更する。本人以外と、決定済み申請の変更を拒否する。
 */
export class UpdateLeaveRequest {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<LeaveRequest | Failure | Error> {
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

    const days = toLeaveDays(command.startDate, command.endDate)

    if (days instanceof Error) {
      return { reason: "invalid_leave_period" }
    }

    const revised = current.withRevised({
      leaveType: command.leaveType,
      startDate: command.startDate,
      endDate: command.endDate,
      days,
      reason: command.reason,
    })

    const updated = await repository.revise(revised)

    if (updated === null) {
      return { reason: "leave_request_not_found" }
    }

    return updated
  }
}

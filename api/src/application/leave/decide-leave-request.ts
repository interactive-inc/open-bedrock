import type { LeaveRequest } from "@/domain/leave/leave-request"
import type { Context } from "@/env"
import { LeaveBalanceRepository } from "@/infrastructure/leave/leave-balance-repository"
import { LeaveRequestRepository } from "@/infrastructure/leave/leave-request-repository"

export type Command = {
  leaveRequestId: number
  approverId: number
  action: "approve" | "reject"
  comment: string | null
  fiscalYear: string
}

export type LeaveRequestNotFound = { failure: "leave_request_not_found" }

/**
 * 休暇申請を承認/却下する。承認時のみ残数を減算する。
 */
export class DecideLeaveRequest {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<LeaveRequest | LeaveRequestNotFound | Error> {
    const leaveRequestRepository = new LeaveRequestRepository(this.c)

    const leaveBalanceRepository = new LeaveBalanceRepository(this.c)

    const existing = await leaveRequestRepository.findById(command.leaveRequestId)

    if (existing instanceof Error) {
      return existing
    }

    if (existing === null) {
      return { failure: "leave_request_not_found" }
    }

    const nextStatus = command.action === "approve" ? "approved" : "rejected"

    const decided = existing.decide({
      status: nextStatus,
      approverId: command.approverId,
      decidedComment: command.comment,
    })

    const updated = await leaveRequestRepository.update(decided)

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return { failure: "leave_request_not_found" }
    }

    if (command.action === "approve") {
      const balance = await leaveBalanceRepository.findByKey({
        employeeId: existing.employeeId,
        leaveType: existing.leaveType,
        fiscalYear: command.fiscalYear,
      })

      if (balance instanceof Error) {
        return balance
      }

      if (balance !== null) {
        const decremented = await leaveBalanceRepository.update(balance.decrement(existing.days))

        if (decremented instanceof Error) {
          return decremented
        }
      }
    }

    return updated
  }
}

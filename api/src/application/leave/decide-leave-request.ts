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

export type AlreadyDecided = { failure: "already_decided" }

export type LeaveBalanceNotFound = { failure: "leave_balance_not_found" }

/**
 * 休暇申請を承認/却下する。pending のみ確定でき、承認確定時のみ残数を減算する。
 */
export class DecideLeaveRequest {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<LeaveRequest | LeaveRequestNotFound | AlreadyDecided | LeaveBalanceNotFound | Error> {
    const leaveRequestRepository = new LeaveRequestRepository(this.c)

    const leaveBalanceRepository = new LeaveBalanceRepository(this.c)

    const existing = await leaveRequestRepository.findById(command.leaveRequestId)

    if (existing instanceof Error) {
      return existing
    }

    if (existing === null) {
      return { failure: "leave_request_not_found" }
    }

    // 承認時は残数レコードの存在を確定前に確認する。レコードが無いまま確定すると
    // 減算がスキップされ、残数未作成の社員が無制限に休暇取得できてしまうため拒否する。
    if (command.action === "approve") {
      const balance = await leaveBalanceRepository.findByKey({
        employeeId: existing.employeeId,
        leaveType: existing.leaveType,
        fiscalYear: command.fiscalYear,
      })

      if (balance instanceof Error) {
        return balance
      }

      if (balance === null) {
        return { failure: "leave_balance_not_found" }
      }
    }

    const nextStatus = command.action === "approve" ? "approved" : "rejected"

    // pending からの条件付き UPDATE。決定済みは 0 行更新（null）となり、再決定と残数の二重減算を防ぐ。
    const decided = await leaveRequestRepository.decideFromPending({
      leaveRequestId: command.leaveRequestId,
      status: nextStatus,
      approverId: command.approverId,
      decidedComment: command.comment,
    })

    if (decided instanceof Error) {
      return decided
    }

    if (decided === null) {
      return { failure: "already_decided" }
    }

    // pending から approved に確定できたときだけ残数を減算する。
    if (command.action === "approve") {
      const balance = await leaveBalanceRepository.findByKey({
        employeeId: decided.employeeId,
        leaveType: decided.leaveType,
        fiscalYear: command.fiscalYear,
      })

      if (balance instanceof Error) {
        return balance
      }

      if (balance === null) {
        return new Error("leave balance not found after decision")
      }

      const decremented = await leaveBalanceRepository.update(balance.decrement(decided.days))

      if (decremented instanceof Error) {
        return decremented
      }
    }

    return decided
  }
}

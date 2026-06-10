import type { LeaveRequest } from "@/domain/leave/leave-request"
import type { Context } from "@/env"
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

export type BalanceNotFound = { failure: "balance_not_found" }

export type InsufficientBalance = { failure: "insufficient_balance" }

export type SelfApproval = { failure: "self_approval" }

/**
 * 休暇申請を承認/却下する。pending のみ確定でき、承認確定時のみ残数を減算する。
 */
export class DecideLeaveRequest {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<
    | LeaveRequest
    | LeaveRequestNotFound
    | AlreadyDecided
    | BalanceNotFound
    | InsufficientBalance
    | SelfApproval
    | Error
  > {
    const leaveRequestRepository = new LeaveRequestRepository(this.c)

    const existing = await leaveRequestRepository.findById(command.leaveRequestId)

    if (existing instanceof Error) {
      return existing
    }

    if (existing === null) {
      return { failure: "leave_request_not_found" }
    }

    if (existing.employeeId === command.approverId) {
      return { failure: "self_approval" }
    }

    const nextStatus = command.action === "approve" ? "approved" : "rejected"

    if (command.action === "approve") {
      const approved = await leaveRequestRepository.approveFromPendingAndConsumeBalance({
        leaveRequestId: command.leaveRequestId,
        approverId: command.approverId,
        decidedComment: command.comment,
        fiscalYear: command.fiscalYear,
      })

      if (approved instanceof Error) {
        return approved
      }

      if (approved === "already_decided") {
        return { failure: "already_decided" }
      }

      if (approved === "balance_not_found") {
        return { failure: "balance_not_found" }
      }

      if (approved === "insufficient_balance") {
        return { failure: "insufficient_balance" }
      }

      return approved
    }

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

    return decided
  }
}

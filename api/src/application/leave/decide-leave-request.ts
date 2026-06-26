import { canDecideLeave } from "@/lib/leave/can-decide-leave"
import type { LeaveRequest } from "@/domain/leave/leave-request.entity"
import { toFiscalYear } from "@/lib/leave/to-fiscal-year"
import type { Context, SessionPayload } from "@/env"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { LeaveRequestRepository } from "@/infrastructure/leave/leave-request-repository"

export type Command = {
  session: SessionPayload
  leaveRequestId: number
  approverId: number
  action: "approve" | "reject"
  comment: string | null
}

/**
 * 休暇申請を承認/却下する。pending のみ確定でき、承認確定時のみ残数を減算する。
 * 会計年度は申請の startDate から導出する（サーバ時刻に依存しない）。
 */
export class DecideLeaveRequest {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<LeaveRequest | ApplicationError> {
    if (canDecideLeave(command.session) === false) {
      return new ForbiddenError("cannot decide leave requests", "forbidden")
    }

    const leaveRequestRepository = new LeaveRequestRepository(this.c)

    const existing = await leaveRequestRepository.findById(command.leaveRequestId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find leave request", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("leave request not found", "leave_request_not_found")
    }

    if (existing.employeeId === command.approverId) {
      return new ForbiddenError("cannot decide own leave request", "self_approval")
    }

    const fiscalYear = toFiscalYear(existing.startDate)

    if (fiscalYear === null) {
      return new ValidationError("invalid leave request start date", "invalid_start_date")
    }

    const nextStatus = command.action === "approve" ? "approved" : "rejected"

    if (command.action === "approve") {
      const approved = await leaveRequestRepository.approveFromPendingAndConsumeBalance({
        leaveRequestId: command.leaveRequestId,
        approverId: command.approverId,
        decidedComment: command.comment,
        fiscalYear,
      })

      if (approved instanceof Error) {
        return new UnexpectedError("failed to approve leave request", { cause: approved })
      }

      if (approved === "already_decided") {
        return new ConflictError("the leave request is already decided", "already_decided")
      }

      if (approved === "balance_not_found") {
        return new ConflictError("leave balance record not found", "balance_not_found")
      }

      if (approved === "insufficient_balance") {
        return new ConflictError("insufficient leave balance", "insufficient_balance")
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
      return new UnexpectedError("failed to decide leave request", { cause: decided })
    }

    if (decided === null) {
      return new ConflictError("the leave request is already decided", "already_decided")
    }

    return decided
  }
}

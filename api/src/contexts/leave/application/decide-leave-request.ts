import type { Session } from "@/contexts/company/domain/iam/session"
import { NotifyApprovalResult } from "@/contexts/company/application/notification/notify-approval-result"
import type { LeaveRequest } from "@/contexts/leave/domain/leave-request.entity"
import { hasLeaveBalanceTracking } from "@/contexts/leave/domain/has-balance-tracking"
import { toFiscalYear } from "@/contexts/leave/domain/to-fiscal-year"
import type { Context } from "@/env"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { LeaveRequestRepository } from "@/contexts/leave/infrastructure/leave-request-repository"
import { resolveOrganizationAuthority } from "@/contexts/company/application/organization/resolve-organization-authority"

export type Command = {
  session: Session
  leaveRequestId: number
  approverId: number
  action: "approve" | "reject"
  comment: string | null
  createdAt: string
}

/**
 * 休暇申請を承認/却下する。pending のみ確定でき、残高管理対象の種別のみ承認確定時に残数を減算する。
 * 会計年度は申請の startDate から導出する（サーバ時刻に依存しない）。
 */
export class DecideLeaveRequest {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<LeaveRequest | ApplicationError> {
    if (command.session.hasPermission("leave:approve") === false) {
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

    const organizationAuthority = await resolveOrganizationAuthority(
      this.c,
      command.approverId,
      existing.employeeId,
    )

    if (organizationAuthority instanceof Error) {
      return new UnexpectedError("failed to resolve organization authority", {
        cause: organizationAuthority,
      })
    }

    const isInScope =
      organizationAuthority.managementChain ||
      organizationAuthority.departmentManager ||
      command.session.hasPermission("org:manage")

    if (isInScope === false) {
      return new ForbiddenError(
        "cannot decide leave request outside organization scope",
        "forbidden",
      )
    }

    const fiscalYear = toFiscalYear(existing.startDate)

    if (fiscalYear === null) {
      return new ValidationError("invalid leave request start date", "invalid_start_date")
    }

    const endFiscalYear = toFiscalYear(existing.endDate)

    if (endFiscalYear === null) {
      return new ValidationError("invalid leave request end date", "invalid_end_date")
    }

    if (fiscalYear !== endFiscalYear) {
      return new ValidationError(
        "leave request spans multiple fiscal years; please split into separate requests",
        "cross_fiscal_year",
      )
    }

    if (command.action === "approve" && hasLeaveBalanceTracking(existing.leaveType)) {
      return this.approveWithBalance(command, existing, leaveRequestRepository, fiscalYear)
    }

    const nextStatus = command.action === "approve" ? "approved" : "rejected"

    return this.finalizeWithoutBalance(command, existing, leaveRequestRepository, nextStatus)
  }

  /** 残高管理対象の種別のみ通る経路。承認と残数消費を D1 batch で確定する。 */
  private async approveWithBalance(
    command: Command,
    existing: LeaveRequest,
    repository: LeaveRequestRepository,
    fiscalYear: string,
  ): Promise<LeaveRequest | ApplicationError> {
    const approved = await repository.approveFromPendingAndConsumeBalance({
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

    await this.notify(command, existing)

    return approved
  }

  /** 却下、および残高管理なし種別の承認が通る経路。残高テーブルは一切触らない。 */
  private async finalizeWithoutBalance(
    command: Command,
    existing: LeaveRequest,
    repository: LeaveRequestRepository,
    nextStatus: "approved" | "rejected",
  ): Promise<LeaveRequest | ApplicationError> {
    const decided = await repository.decideFromPending({
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

    await this.notify(command, existing)

    return decided
  }

  /** 決定は確定済みのため、申請者への結果通知が失敗しても決定は返す。 */
  private async notify(command: Command, existing: LeaveRequest): Promise<void> {
    await new NotifyApprovalResult(this.c).run({
      recipientEmployeeId: existing.employeeId,
      action: command.action,
      subjectLabel: "休暇申請",
      sourceDomain: "leave",
      sourceId: command.leaveRequestId,
      createdAt: command.createdAt,
    })
  }
}

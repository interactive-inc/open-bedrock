import type { Session } from "@/contexts/company/domain/iam/session"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/d1/is-aborted-by-guard"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ShiftSwapRequest } from "@/domain/shift/shift-swap-request.entity"
import type { Context } from "@/env"
import { EmployeeNotificationGateway } from "@/infrastructure/company/notifications/employee-notification.gateway"
import { ShiftAssignmentRepository } from "@/infrastructure/shift/shift-assignment-repository"
import { ShiftSwapRequestRepository } from "@/infrastructure/shift/shift-swap-request-repository"

export type Input = {
  session: Session
  approverId: number
  swapRequestId: number
  approvedAt: string
}

/**
 * 権限を確認し、保留中のシフト交代申請を承認する。
 * 承認時に両者のシフト割当の pattern_id をアトミックに入れ替え、両者へ通知を送る。
 */
export class ApproveShiftSwapRequest {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ShiftSwapRequest | ApplicationError> {
    if (input.session.hasPermission("shift_swap:approve") === false) {
      return new ForbiddenError("cannot approve shift swap", "forbidden")
    }

    const swapRequestRepository = new ShiftSwapRequestRepository(this.c)

    const swapRequest = await swapRequestRepository.findById(input.swapRequestId)

    if (swapRequest instanceof Error) {
      return new UnexpectedError("failed to find shift swap request", { cause: swapRequest })
    }

    if (swapRequest === null) {
      return new NotFoundError("shift swap request not found", "swap_request_not_found")
    }

    // 当事者（申請者・交代相手）による自己承認を拒否する。他の承認系と同じ本人ガード。
    if (
      input.approverId === swapRequest.requesterEmployeeId ||
      input.approverId === swapRequest.targetEmployeeId
    ) {
      return new ForbiddenError("cannot self-approve shift swap", "forbidden")
    }

    if (swapRequest.status !== "pending") {
      return new ConflictError("shift swap request is not pending", "not_pending")
    }

    // 両者の割当を取得する。どちらか一方でも無ければ承認を拒否する。
    const assignmentRepository = new ShiftAssignmentRepository(this.c)

    const requesterAssignment = await assignmentRepository.findByEmployeeIdAndDate(
      swapRequest.requesterEmployeeId,
      swapRequest.date,
    )

    if (requesterAssignment instanceof Error) {
      return new UnexpectedError("failed to find shift assignment", { cause: requesterAssignment })
    }

    if (requesterAssignment === null) {
      return new ConflictError("shift assignment not found for swap", "assignment_not_found")
    }

    const targetAssignment = await assignmentRepository.findByEmployeeIdAndDate(
      swapRequest.targetEmployeeId,
      swapRequest.date,
    )

    if (targetAssignment instanceof Error) {
      return new UnexpectedError("failed to find shift assignment", { cause: targetAssignment })
    }

    if (targetAssignment === null) {
      return new ConflictError("shift assignment not found for swap", "assignment_not_found")
    }

    // pattern_id を入れ替え、ステータス更新をアトミックに実行する。
    // status='pending' ガード付きで先にステータスを更新し、並行承認による二重スワップを防ぐ。
    // 0 行更新（既に承認/却下済み）は abortWhenPreviousStatementChangedNoRows でバッチ全体を中断する。
    //
    // 各割当の UPDATE にも楽観ロック（AND pattern_id = ?expected）を付けて、同一社員が
    // 同日に複数の交換申請を持つ場合の並行承認で lost update を防ぐ。
    const approved = swapRequest.withApproved(input.approvedAt)

    try {
      const db = this.c.env.DB
      await db.batch([
        db
          .prepare(
            "UPDATE shift_swap_requests SET status = ?1, approved_at = ?2 WHERE id = ?3 AND status = 'pending'",
          )
          .bind(approved.status, approved.approvedAt, swapRequest.id),
        abortWhenPreviousStatementChangedNoRows(db),
        db
          .prepare(
            "UPDATE shift_assignments SET pattern_id = ?1 WHERE id = ?2 AND pattern_id IS ?3",
          )
          .bind(targetAssignment.patternId, requesterAssignment.id, requesterAssignment.patternId),
        abortWhenPreviousStatementChangedNoRows(db),
        db
          .prepare(
            "UPDATE shift_assignments SET pattern_id = ?1 WHERE id = ?2 AND pattern_id IS ?3",
          )
          .bind(requesterAssignment.patternId, targetAssignment.id, targetAssignment.patternId),
        abortWhenPreviousStatementChangedNoRows(db),
      ])
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return new ConflictError(
          "shift swap conflict: request or assignment changed concurrently",
          "conflict",
        )
      }
      return error instanceof Error
        ? new UnexpectedError("failed to swap shift assignments", { cause: error })
        : new UnexpectedError("failed to swap shift assignments")
    }

    // 通知はベストエフォート。交換は完了済みなので、通知が失敗してもログのみ残して結果を返す。
    await this.notifySwap(swapRequest, input.approvedAt)

    return approved
  }

  private async notifySwap(swapRequest: ShiftSwapRequest, createdAt: string): Promise<void> {
    const notificationGateway = new EmployeeNotificationGateway(this.c)

    const requesterNotified = await notificationGateway.create({
      recipientEmployeeId: swapRequest.requesterEmployeeId,
      kind: "approval_result",
      title: `${swapRequest.date} のシフト交代申請が承認されました`,
      body: swapRequest.note,
      sourceDomain: "shift_swap_request",
      sourceId: swapRequest.id,
      createdAt,
    })

    if (requesterNotified instanceof Error) {
      console.error("failed to create swap notification for requester", requesterNotified)
    }

    const targetNotified = await notificationGateway.create({
      recipientEmployeeId: swapRequest.targetEmployeeId,
      kind: "approval_result",
      title: `${swapRequest.date} のシフト交代が承認されました`,
      body: swapRequest.note,
      sourceDomain: "shift_swap_request",
      sourceId: swapRequest.id,
      createdAt,
    })

    if (targetNotified instanceof Error) {
      console.error("failed to create swap notification for target", targetNotified)
    }
  }
}

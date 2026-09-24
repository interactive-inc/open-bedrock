import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ShiftSwapRequest } from "@/contexts/shift/domain/entities/shift-swap-request.entity"
import type { Context as HonoContext } from "@/env"
import { ShiftAssignmentRepository } from "@/contexts/shift/infrastructure/repositories/shift-assignment.repository"
import { isCompanyWriteAbortedByGuard } from "@/contexts/company/interface/operations/is-company-write-aborted-by-guard"
import { ShiftSwapDecisionAuthorityAdapter } from "@/contexts/shift/infrastructure/adapters/shift-swap-decision-authority.adapter"
import { ShiftSwapRequestRepository } from "@/contexts/shift/infrastructure/repositories/shift-swap-request.repository"

export type Input = {
  session: CompanySessionValue
  approverId: EmployeeId
  swapRequestId: number
  approvedAt: string
}

type Context = Readonly<{
  context: HonoContext
  publishEmployeeNotification?: (notification: {
    recipientEmployeeId: EmployeeId
    kind: "approval_result"
    title: string
    body: string | null
    sourceDomain: string
    sourceId: number | null
    createdAt: string
  }) => Promise<unknown>
}>

/**
 * 技術的権限と、申請者・交代相手の両方に対するCompany上の管理範囲を確認し、保留中のシフト交代申請を承認する。
 * 承認時に両者のシフト割当の pattern_id をアトミックに入れ替え、両者へ通知を送る。
 */
export class ApproveShiftSwapRequest {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(input: Input): Promise<ShiftSwapRequest | ApplicationError> {
    if (input.session.hasPermission("shift_swap:approve") === false) {
      return new ForbiddenError("cannot approve shift swap", "forbidden")
    }

    const swapRequestRepository = new ShiftSwapRequestRepository(this.c.context)

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
    const assignmentRepository = new ShiftAssignmentRepository(this.c.context)

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
    const authority = await new ShiftSwapDecisionAuthorityAdapter(this.c.context).prepare({
      session: input.session,
      subjectEmployeeIds: [swapRequest.requesterEmployeeId, swapRequest.targetEmployeeId],
    })

    if (authority instanceof Error) {
      return new ForbiddenError(authority.message, authority.code, { cause: authority })
    }

    const approved = swapRequest.withApproved(input.approvedAt)

    const persisted = await swapRequestRepository.approveWithAssignmentSwap({
      approved,
      requesterAssignment,
      targetAssignment,
      guards: authority.guards,
    })

    if (persisted instanceof Error) {
      if (isCompanyWriteAbortedByGuard(persisted))
        return new ConflictError(
          "company authority changed before saving",
          "company_authority_changed",
          { cause: persisted },
        )
      return new UnexpectedError("failed to swap shift assignments", { cause: persisted })
    }

    if ("reason" in persisted) {
      return new ConflictError(
        "shift swap conflict: request or assignment changed concurrently",
        "conflict",
      )
    }

    // 通知はベストエフォート。交換は完了済みなので、通知が失敗してもログのみ残して結果を返す。
    await this.notifySwap(swapRequest, input.approvedAt)

    return persisted
  }

  private async notifySwap(swapRequest: ShiftSwapRequest, createdAt: string): Promise<void> {
    const requesterNotified = await this.c.publishEmployeeNotification?.({
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

    const targetNotified = await this.c.publishEmployeeNotification?.({
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

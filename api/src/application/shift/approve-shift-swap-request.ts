import { Notification } from "@/domain/notification/notification"
import { canApproveShiftSwap } from "@/domain/shift/can-approve-shift-swap"
import type { ShiftSwapRequest } from "@/domain/shift/shift-swap-request"
import type { Context } from "@/env"
import { NotificationRepository } from "@/infrastructure/notification/notification-repository"
import { ShiftAssignmentRepository } from "@/infrastructure/shift/shift-assignment-repository"
import { ShiftSwapRequestRepository } from "@/infrastructure/shift/shift-swap-request-repository"
import { shiftAssignments, shiftSwapRequests } from "@/schema"
import { eq } from "drizzle-orm"

export type Input = {
  viewerRole: string
  swapRequestId: number
  approvedAt: string
}

export type Forbidden = { reason: "forbidden" }

export type SwapRequestNotFound = { reason: "swap_request_not_found" }

export type AlreadyApproved = { reason: "already_approved" }

export type NotPending = { reason: "not_pending" }

export type AssignmentNotFound = { reason: "assignment_not_found" }

/**
 * 権限を確認し、保留中のシフト交代申請を承認する。
 * 承認時に両者のシフト割当の pattern_id をアトミックに入れ替え、両者へ通知を送る。
 */
export class ApproveShiftSwapRequest {
  constructor(private readonly c: Context) {}

  async run(
    input: Input,
  ): Promise<
    | ShiftSwapRequest
    | Forbidden
    | SwapRequestNotFound
    | AlreadyApproved
    | NotPending
    | AssignmentNotFound
    | Error
  > {
    if (canApproveShiftSwap(input.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const swapRequestRepository = new ShiftSwapRequestRepository(this.c)

    const swapRequest = await swapRequestRepository.findById(input.swapRequestId)

    if (swapRequest instanceof Error) {
      return swapRequest
    }

    if (swapRequest === null) {
      return { reason: "swap_request_not_found" }
    }

    if (swapRequest.status !== "pending") {
      return { reason: "not_pending" }
    }

    // 両者の割当を取得する。どちらか一方でも無ければ承認を拒否する。
    const assignmentRepository = new ShiftAssignmentRepository(this.c)

    const requesterAssignment = await assignmentRepository.findByEmployeeIdAndDate(
      swapRequest.requesterEmployeeId,
      swapRequest.date,
    )

    if (requesterAssignment instanceof Error) {
      return requesterAssignment
    }

    if (requesterAssignment === null) {
      return { reason: "assignment_not_found" }
    }

    const targetAssignment = await assignmentRepository.findByEmployeeIdAndDate(
      swapRequest.targetEmployeeId,
      swapRequest.date,
    )

    if (targetAssignment instanceof Error) {
      return targetAssignment
    }

    if (targetAssignment === null) {
      return { reason: "assignment_not_found" }
    }

    // pattern_id を入れ替え、ステータス更新をアトミックに実行する。
    const approved = swapRequest.withApproved(input.approvedAt)

    try {
      await this.c.var.database.batch([
        this.c.var.database
          .update(shiftAssignments)
          .set({ patternId: targetAssignment.patternId })
          .where(eq(shiftAssignments.id, requesterAssignment.id!)),
        this.c.var.database
          .update(shiftAssignments)
          .set({ patternId: requesterAssignment.patternId })
          .where(eq(shiftAssignments.id, targetAssignment.id!)),
        this.c.var.database
          .update(shiftSwapRequests)
          .set({ status: approved.status, approvedAt: approved.approvedAt })
          .where(eq(shiftSwapRequests.id, swapRequest.id!)),
      ])
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to swap shift assignments")
    }

    // 通知はベストエフォート。交換は完了済みなので、通知が失敗してもログのみ残して結果を返す。
    await this.notifySwap(swapRequest, input.approvedAt)

    return approved
  }

  private async notifySwap(swapRequest: ShiftSwapRequest, createdAt: string): Promise<void> {
    const notificationRepository = new NotificationRepository(this.c)

    const requesterNotification = Notification.create({
      recipientEmployeeId: swapRequest.requesterEmployeeId,
      kind: "approval_result",
      title: `${swapRequest.date} のシフト交代申請が承認されました`,
      body: swapRequest.note,
      sourceDomain: "shift_swap_request",
      sourceId: swapRequest.id,
      createdAt,
    })

    const requesterNotified = await notificationRepository.create(requesterNotification)

    if (requesterNotified instanceof Error) {
      console.error("failed to create swap notification for requester", requesterNotified)
    }

    const targetNotification = Notification.create({
      recipientEmployeeId: swapRequest.targetEmployeeId,
      kind: "approval_result",
      title: `${swapRequest.date} のシフト交代が承認されました`,
      body: swapRequest.note,
      sourceDomain: "shift_swap_request",
      sourceId: swapRequest.id,
      createdAt,
    })

    const targetNotified = await notificationRepository.create(targetNotification)

    if (targetNotified instanceof Error) {
      console.error("failed to create swap notification for target", targetNotified)
    }
  }
}

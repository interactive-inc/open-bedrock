import { canApproveShiftSwap } from "@/domain/shift/can-approve-shift-swap"
import type { ShiftSwapRequest } from "@/domain/shift/shift-swap-request"
import type { Context } from "@/env"
import { ShiftSwapRequestRepository } from "@/infrastructure/shift/shift-swap-request-repository"

export type Input = {
  viewerRole: string
  swapRequestId: number
  approvedAt: string
}

export type Forbidden = { reason: "forbidden" }

export type SwapRequestNotFound = { reason: "swap_request_not_found" }

export type AlreadyApproved = { reason: "already_approved" }

/**
 * 権限を確認し、保留中のシフト交代申請を承認する。
 */
export class ApproveShiftSwapRequest {
  constructor(private readonly c: Context) {}

  async run(
    input: Input,
  ): Promise<ShiftSwapRequest | Forbidden | SwapRequestNotFound | AlreadyApproved | Error> {
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

    if (swapRequest.status === "approved") {
      return { reason: "already_approved" }
    }

    const approved = await swapRequestRepository.update(swapRequest.withApproved(input.approvedAt))

    if (approved instanceof Error) {
      return approved
    }

    if (approved === null) {
      return { reason: "already_approved" }
    }

    return approved
  }
}

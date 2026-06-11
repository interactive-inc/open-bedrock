import type { Context } from "@/env"
import { ShiftSwapRequestRepository } from "@/infrastructure/shift/shift-swap-request-repository"

export type Input = {
  requesterEmployeeId: number
  swapRequestId: number
}

export type SwapRequestNotFound = { reason: "swap_request_not_found" }

export type NotRequester = { reason: "not_requester" }

export type AlreadyApproved = { reason: "already_approved" }

export type Cancelled = { reason: "cancelled" }

/**
 * 申請者本人が保留中のシフト交代申請を取り下げる。承認済みは取り下げできない。
 */
export class CancelShiftSwapRequest {
  constructor(private readonly c: Context) {}

  async run(
    input: Input,
  ): Promise<Cancelled | SwapRequestNotFound | NotRequester | AlreadyApproved | Error> {
    const swapRequestRepository = new ShiftSwapRequestRepository(this.c)

    const current = await swapRequestRepository.findById(input.swapRequestId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "swap_request_not_found" }
    }

    if (current.requesterEmployeeId !== input.requesterEmployeeId) {
      return { reason: "not_requester" }
    }

    if (current.status === "approved") {
      return { reason: "already_approved" }
    }

    const deleted = await swapRequestRepository.delete(input.swapRequestId)

    if (deleted instanceof Error) {
      return deleted
    }

    if (deleted === null) {
      return { reason: "already_approved" }
    }

    return { reason: "cancelled" }
  }
}

import { canApproveShiftSwap } from "@/domain/shift/can-approve-shift-swap"
import type { ShiftSwapRequest } from "@/domain/shift/shift-swap-request"
import type { Context } from "@/env"
import { ShiftSwapRequestRepository } from "@/infrastructure/shift/shift-swap-request-repository"

export type Input = {
  viewerEmployeeId: number
  viewerRole: string
  swapRequestId: number
}

export type SwapRequestNotFound = { reason: "swap_request_not_found" }

export type NotVisible = { reason: "not_visible" }

/**
 * シフト交代申請を1件取得する。申請者本人・対象社員・承認権限者のみ閲覧できる。
 */
export class GetShiftSwapRequest {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ShiftSwapRequest | SwapRequestNotFound | NotVisible | Error> {
    const swapRequestRepository = new ShiftSwapRequestRepository(this.c)

    const swapRequest = await swapRequestRepository.findById(input.swapRequestId)

    if (swapRequest instanceof Error) {
      return swapRequest
    }

    if (swapRequest === null) {
      return { reason: "swap_request_not_found" }
    }

    const isRequester = swapRequest.requesterEmployeeId === input.viewerEmployeeId

    const isTargetEmployee = swapRequest.targetEmployeeId === input.viewerEmployeeId

    if (isRequester === false && isTargetEmployee === false && canApproveShiftSwap(input.viewerRole) === false) {
      return { reason: "not_visible" }
    }

    return swapRequest
  }
}

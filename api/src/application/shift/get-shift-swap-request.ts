import { canApproveShiftSwap } from "@/lib/shift/can-approve-shift-swap"
import { canViewAllShiftSwaps } from "@/lib/shift/can-view-all-shift-swaps"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ShiftSwapRequest } from "@/domain/shift/shift-swap-request.entity"
import type { Context, SessionPayload } from "@/env"
import { ShiftSwapRequestRepository } from "@/infrastructure/shift/shift-swap-request-repository"

export type Input = {
  viewerEmployeeId: number
  session: SessionPayload
  swapRequestId: number
}

/**
 * シフト交代申請を1件取得する。申請者本人・対象社員・承認権限者のみ閲覧できる。
 */
export class GetShiftSwapRequest {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ShiftSwapRequest | ApplicationError> {
    const swapRequestRepository = new ShiftSwapRequestRepository(this.c)

    const swapRequest = await swapRequestRepository.findById(input.swapRequestId)

    if (swapRequest instanceof Error) {
      return new UnexpectedError("failed to find shift swap request", { cause: swapRequest })
    }

    if (swapRequest === null) {
      return new NotFoundError("shift swap request not found", "swap_request_not_found")
    }

    const isRequester = swapRequest.requesterEmployeeId === input.viewerEmployeeId

    const isTargetEmployee = swapRequest.targetEmployeeId === input.viewerEmployeeId

    if (
      isRequester === false &&
      isTargetEmployee === false &&
      canApproveShiftSwap(input.session) === false &&
      canViewAllShiftSwaps(input.session) === false
    ) {
      return new ForbiddenError("cannot view this shift swap request", "not_visible")
    }

    return swapRequest
  }
}

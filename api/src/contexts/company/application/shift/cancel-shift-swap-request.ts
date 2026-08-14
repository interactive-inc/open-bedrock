import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ShiftSwapRequestRepository } from "@/contexts/company/infrastructure/shift/shift-swap-request-repository"

export type Input = {
  requesterEmployeeId: number
  swapRequestId: number
}

export type Cancelled = { reason: "cancelled" }

/**
 * 申請者本人が保留中のシフト交代申請を取り下げる。承認済みは取り下げできない。
 */
export class CancelShiftSwapRequest {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<Cancelled | ApplicationError> {
    const swapRequestRepository = new ShiftSwapRequestRepository(this.c)

    const current = await swapRequestRepository.findById(input.swapRequestId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find shift swap request", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("shift swap request not found", "swap_request_not_found")
    }

    if (current.requesterEmployeeId !== input.requesterEmployeeId) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    if (current.status === "approved") {
      return new ConflictError(
        "approved shift swap request cannot be cancelled",
        "already_approved",
      )
    }

    const deleted = await swapRequestRepository.delete(input.swapRequestId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete shift swap request", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError(
        "approved shift swap request cannot be cancelled",
        "already_approved",
      )
    }

    return { reason: "cancelled" }
  }
}

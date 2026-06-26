import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ShiftSwapRequest } from "@/domain/shift/shift-swap-request.entity"
import type { Context } from "@/env"
import { ShiftSwapRequestRepository } from "@/infrastructure/shift/shift-swap-request-repository"

export type Input = {
  requesterEmployeeId: number
  limit: number
  offset: number
}

/**
 * 申請者本人が出したシフト交代申請を一覧する。
 */
export class ListMyShiftSwapRequests {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ReadonlyArray<ShiftSwapRequest> | ApplicationError> {
    const swapRequestRepository = new ShiftSwapRequestRepository(this.c)

    const swapRequests = await swapRequestRepository.findByRequesterId({
      requesterEmployeeId: input.requesterEmployeeId,
      limit: input.limit,
      offset: input.offset,
    })

    if (swapRequests instanceof Error) {
      return new UnexpectedError("failed to find shift swap requests", { cause: swapRequests })
    }

    return swapRequests
  }
}

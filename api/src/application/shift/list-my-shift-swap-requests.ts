import type { ShiftSwapRequest } from "@/domain/shift/shift-swap-request"
import type { Context } from "@/env"
import { ShiftSwapRequestRepository } from "@/infrastructure/shift/shift-swap-request-repository"

export type Input = {
  requesterEmployeeId: number
}

/**
 * 申請者本人が出したシフト交代申請を一覧する。
 */
export class ListMyShiftSwapRequests {
  constructor(private readonly c: Context) {}

  async run(input: Input): Promise<ReadonlyArray<ShiftSwapRequest> | Error> {
    const swapRequestRepository = new ShiftSwapRequestRepository(this.c)

    return swapRequestRepository.findByRequesterId(input.requesterEmployeeId)
  }
}

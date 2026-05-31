import { createClient } from "@/lib/api/hc-client"
import type { ShiftSwapRequestResponse } from "@/lib/api/types/shift-types"

// POST /shift/swap-requests/:id/approve。特権ロールが保留中の交代申請を承認する。
export async function approveShiftSwapRequest(
  swapRequestId: number,
): Promise<ShiftSwapRequestResponse | Error> {
  const client = await createClient()

  const response = await client.shift["swap-requests"][":id"].approve.$post({
    param: { id: String(swapRequestId) },
  })

  if (response.status >= 400) {
    return new Error("failed to approve shift swap request")
  }

  return response.json()
}

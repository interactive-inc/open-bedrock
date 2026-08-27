import { createClient } from "@/lib/api/hc-client"
import type { MyShiftSwapRequestResponse } from "@/lib/api/types/shift-types"

/** GET /shift-swap-requests/me。申請者本人が出した交代申請の一覧。 */
export async function getMyShiftSwapRequests(): Promise<Array<MyShiftSwapRequestResponse> | Error> {
  const client = await createClient()

  const response = await client["shift"]["shift-swap-requests"].me.$get()

  if (response.status >= 400) {
    return new Error("failed to load my shift swap requests")
  }

  const body = await response.json()

  return body.data
}

import { createClient } from "@/lib/api/hc-client"
import type {
  ShiftSwapRequestCreateRequest,
  ShiftSwapRequestResponse,
} from "@/lib/api/types/shift-types"

// POST /shift/swap-requests。本人が対象社員へシフト交代を申請する。
export async function createShiftSwapRequest(
  request: ShiftSwapRequestCreateRequest,
): Promise<ShiftSwapRequestResponse | Error> {
  const client = await createClient()

  const response = await client.shift["swap-requests"].$post({
    json: {
      target_employee_code: request.target_employee_code,
      date: request.date,
      note: request.note ?? undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to create shift swap request")
  }

  return response.json()
}

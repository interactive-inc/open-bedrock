import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
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
    return toResponseError(response, {
      fallback: "シフト交代の申請に失敗しました",
      conflictMessages: {
        "pending swap request already exists": "保留中の交代申請が既にあります",
      },
    })
  }

  return response.json()
}

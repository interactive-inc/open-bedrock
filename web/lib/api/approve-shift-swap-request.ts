import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export async function approveShiftSwapRequest(id: number) {
  const client = await createClient()

  const response = await client["shift-swap-requests"][":id"].approve.$post({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "シフト交代申請の承認に失敗しました",
      conflictMessages: {
        "shift assignment not found for swap": "対象日のシフト割当が見つかりません",
        "shift swap request is not pending": "この申請は既に処理済みです",
      },
    })
  }

  return response.json()
}

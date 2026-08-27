import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ShiftPatternResponse } from "@/lib/api/types/shift-types"

export type ShiftPatternUpdateRequest = {
  code: string
  name: string
  start_time: string
  end_time: string
  break_minutes: number
}

/** PUT /shift-patterns/:id。特権ロールがシフトパターンの内容を変更する。 */
export async function updateShiftPattern(
  id: number,
  request: ShiftPatternUpdateRequest,
): Promise<ShiftPatternResponse | Error> {
  const client = await createClient()

  const response = await client["shift"]["shift-patterns"][":id"].$put({
    param: { id: String(id) },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "シフトパターンの変更に失敗しました",
      conflictMessages: {
        "pattern code already exists": "このパターンコードは既に使用されています",
      },
    })
  }

  return response.json()
}

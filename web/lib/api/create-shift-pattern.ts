import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ShiftPatternCreateRequest, ShiftPatternResponse } from "@/lib/api/types/shift-types"

/** POST /shift/patterns。特権ロールがシフトパターンを作成する。 */
export async function createShiftPattern(
  request: ShiftPatternCreateRequest,
): Promise<ShiftPatternResponse | Error> {
  const client = await createClient()

  const response = await client.shift.patterns.$post({
    json: {
      code: request.code,
      name: request.name,
      start_time: request.start_time,
      end_time: request.end_time,
      break_minutes: request.break_minutes ?? undefined,
    },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "シフトパターンの作成に失敗しました",
      conflictMessages: {
        "pattern code already exists": "このパターンコードは既に使用されています",
      },
    })
  }

  return response.json()
}

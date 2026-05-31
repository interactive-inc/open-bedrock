import { createClient } from "@/lib/api/hc-client"
import type { ShiftPatternCreateRequest, ShiftPatternResponse } from "@/lib/api/types/shift-types"

// POST /shift/patterns。特権ロールがシフトパターンを作成する。
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
    return new Error("failed to create shift pattern")
  }

  return response.json()
}

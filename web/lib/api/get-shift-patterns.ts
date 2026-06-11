import { createClient } from "@/lib/api/hc-client"
import type { ShiftPatternResponse } from "@/lib/api/types/shift-types"

// GET /shift/patterns。全ユーザーがシフトパターン一覧を閲覧できる。
export async function getShiftPatterns(): Promise<Array<ShiftPatternResponse> | Error> {
  const client = await createClient()

  const response = await client.shift.patterns.$get()

  if (response.status >= 400) {
    return new Error("failed to load shift patterns")
  }

  const body = await response.json()

  return body.data
}

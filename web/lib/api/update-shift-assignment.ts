import { createClient } from "@/lib/api/hc-client"
import type { ShiftAssignmentResponse } from "@/lib/api/types/shift-types"

export type ShiftAssignmentUpdateRequest = {
  pattern_code: string | null
  date: string
  note: string | null
}

// PUT /shift/assignments/:id。特権ロールが割当のパターン・日付・備考を変更する。
export async function updateShiftAssignment(
  id: number,
  request: ShiftAssignmentUpdateRequest,
): Promise<ShiftAssignmentResponse | Error> {
  const client = await createClient()

  const response = await client.shift.assignments[":id"].$put({
    param: { id: String(id) },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to update shift assignment")
  }

  return response.json()
}

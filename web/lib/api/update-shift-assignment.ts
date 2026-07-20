import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ShiftAssignmentResponse } from "@/lib/api/types/shift-types"

export type ShiftAssignmentUpdateRequest = {
  pattern_code: string | null
  date: string
  note: string | null
}

/** PUT /shift/assignments/:id。特権ロールが割当のパターン・日付・備考を変更する。 */
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
    return toResponseError(response, {
      fallback: "シフト割当の変更に失敗しました",
      conflictMessages: {
        "shift assignment is already published": "公開済みのシフト割当は変更できません",
      },
    })
  }

  return response.json()
}

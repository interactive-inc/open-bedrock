import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ShiftAssignmentResponse } from "@/lib/api/types/shift-types"

// POST /shift/assignments/:id/publish。特権ロールが未公開の割当を公開する。
export async function publishShiftAssignment(
  assignmentId: number,
): Promise<ShiftAssignmentResponse | Error> {
  const client = await createClient()

  const response = await client.shift.assignments[":id"].publish.$post({
    param: { id: String(assignmentId) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "シフトの公開に失敗しました",
      conflictMessages: {
        "already published": "このシフトは既に公開されています",
      },
    })
  }

  return response.json()
}

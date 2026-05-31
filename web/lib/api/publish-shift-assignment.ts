import { createClient } from "@/lib/api/hc-client"
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
    return new Error("failed to publish shift assignment")
  }

  return response.json()
}

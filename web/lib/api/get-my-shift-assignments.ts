import { createClient } from "@/lib/api/hc-client"
import type { MyShiftAssignmentResponse } from "@/lib/api/types/shift-types"

/** GET /shift/assignments/me。本人の担当シフト一覧。日付範囲で絞り込み可能。 */
export async function getMyShiftAssignments(
  from: string | null,
  to: string | null,
): Promise<Array<MyShiftAssignmentResponse> | Error> {
  const client = await createClient()

  const response = await client.shift.assignments.me.$get({
    query: { from: from ?? undefined, to: to ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load my shift assignments")
  }

  const body = await response.json()

  return body.data
}

import { createClient } from "@/lib/api/hc-client"
import type { GoalResponse, GoalUpdateRequest } from "@/lib/api/types/goal-types"

// PUT /goals/:goalId。目標の定義を変更する。
// 本人以外は 403、確定評価済みは 409 を api が返すため、戻りは Error になる。
export async function updateGoal(
  goalId: number,
  request: GoalUpdateRequest,
): Promise<GoalResponse | Error> {
  const client = await createClient()

  const response = await client.goals[":goal_id"].$put({
    param: { goal_id: String(goalId) },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to update goal")
  }

  return response.json()
}

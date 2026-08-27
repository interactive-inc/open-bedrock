import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { GoalResponse, GoalUpdateRequest } from "@/lib/api/types/goal-types"

/**
 * PUT /performance-goals/:goalId。目標の定義を変更する。
 * 本人以外は 403、確定評価済みは 409 を api が返すため、戻りは Error になる。
 */
export async function updateGoal(
  goalId: number,
  request: GoalUpdateRequest,
): Promise<GoalResponse | Error> {
  const client = await createClient()

  const response = await client["performance-review"]["performance-goals"][":goalId"].$put({
    param: { goalId: String(goalId) },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "目標の変更に失敗しました",
      conflictMessages: {
        "the goal is already finalized": "確定済みの目標は変更できません",
      },
    })
  }

  return response.json()
}

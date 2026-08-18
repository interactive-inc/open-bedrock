import { createClient } from "@/lib/api/hc-client"

/** GET /performance-goals/:goal_id/evaluations。目標に紐づく評価一覧を登録順で取得する。 */
export async function getGoalEvaluations(goalId: number) {
  const client = await createClient()

  const response = await client["performance-goals"][":goal_id"].evaluations.$get({
    param: { goal_id: String(goalId) },
  })

  if (response.status >= 400) {
    return new Error("failed to load goal evaluations")
  }

  return response.json()
}

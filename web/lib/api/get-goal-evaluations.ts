import { createClient } from "@/lib/api/hc-client"

/** GET /performance-goals/:goalId/evaluations。目標に紐づく評価一覧を登録順で取得する。 */
export async function getGoalEvaluations(goalId: number) {
  const client = await createClient()

  const response = await client["performance-goals"][":goalId"].evaluations.$get({
    param: { goalId: String(goalId) },
  })

  if (response.status >= 400) {
    return new Error("failed to load goal evaluations")
  }

  return response.json()
}

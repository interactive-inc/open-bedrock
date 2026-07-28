import type { ApiClient } from "api/app"
import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** api の zValidator が宣言する json 入力型をそのまま使う（手動型と二重管理しない）。 */
type GoalEvaluationCreateRequest = Parameters<
  ApiClient["performance-goals"][":goal_id"]["evaluations"]["$post"]
>[0]["json"]

type Props = {
  goalId: number
  request: GoalEvaluationCreateRequest
}

/**
 * POST /performance-goals/:goal_id/evaluations。session トークンで評価を登録する。
 * kind=final の場合は api 側で目標が done に更新される。
 * 戻りは作成された GoalEvaluation or Error。呼び出し元は instanceof Error で判別する。
 */
export async function createGoalEvaluation(props: Props) {
  const client = await createClient()

  const response = await client["performance-goals"][":goal_id"].evaluations.$post({
    param: { goal_id: String(props.goalId) },
    json: props.request,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "目標評価の登録に失敗しました",
      conflictMessages: {
        "already evaluated": "この目標は既に評価済みです",
        "goal is already finalized": "確定済みの目標には評価を登録できません",
      },
    })
  }

  return response.json()
}

import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { GoalCreateRequest } from "@/lib/api/types/goal-types"

// POST /goals。session トークンで目標を新規作成する。
// 戻りは作成された Goal or Error。呼び出し元は instanceof Error で判別する。
export async function createGoal(request: GoalCreateRequest) {
  const client = await createClient()

  const response = await client.goals.$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "目標の作成に失敗しました",
    })
  }

  return response.json()
}

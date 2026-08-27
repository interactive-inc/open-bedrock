import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * DELETE /performance-goals/:goalId。目標を削除する。
 * 本人以外は 403、不存在は 404、確定評価済みは 409 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function deleteGoal(goalId: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client["performance-review"]["performance-goals"][":goalId"].$delete({
    param: { goalId: String(goalId) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "目標の削除に失敗しました",
      conflictMessages: {
        "the goal is already finalized": "確定済みの目標は削除できません",
      },
    })
  }

  return null
}

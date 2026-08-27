import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ReviewCycleUpdateRequest } from "@/lib/api/types/review-types"

/** PUT /review-cycles/:cycleId。特権ロールがサイクルの題目・期間・締切を更新する。 */
export async function updateReviewCycle(cycleId: number, request: ReviewCycleUpdateRequest) {
  const client = await createClient()

  const json: { title: string; period: string; dueDate?: string } =
    request.dueDate === null
      ? { title: request.title, period: request.period }
      : { title: request.title, period: request.period, dueDate: request.dueDate }

  const response = await client["performance-review"]["review-cycles"][":cycleId"].$put({
    param: { cycleId: String(cycleId) },
    json,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "評価サイクルの変更に失敗しました",
      conflictMessages: {
        "not modifiable": "この評価サイクルは変更できません",
        "not editable": "この評価サイクルは編集できません",
      },
    })
  }

  return response.json()
}

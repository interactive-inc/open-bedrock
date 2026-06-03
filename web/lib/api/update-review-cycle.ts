import { createClient } from "@/lib/api/hc-client"
import type { ReviewCycleUpdateRequest } from "@/lib/api/types/review-types"

// PUT /review-cycles/:cycle_id。特権ロールがサイクルの題目・期間・締切を更新する。
export async function updateReviewCycle(cycleId: number, request: ReviewCycleUpdateRequest) {
  const client = await createClient()

  const json: { title: string; period: string; dueDate?: string } =
    request.dueDate === null
      ? { title: request.title, period: request.period }
      : { title: request.title, period: request.period, dueDate: request.dueDate }

  const response = await client["review-cycles"][":cycle_id"].$put({
    param: { cycle_id: String(cycleId) },
    json,
  })

  if (response.status >= 400) {
    return new Error("failed to update review cycle")
  }

  return response.json()
}

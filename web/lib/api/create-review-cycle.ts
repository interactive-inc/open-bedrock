import { createClient } from "@/lib/api/hc-client"
import type { ReviewCycleCreateRequest } from "@/lib/api/types/review-types"

// POST /review-cycles。特権ロールが draft の評価サイクルを作成する。
export async function createReviewCycle(request: ReviewCycleCreateRequest) {
  const client = await createClient()

  const json: { title: string; period: string; dueDate?: string } =
    request.dueDate === null
      ? { title: request.title, period: request.period }
      : { title: request.title, period: request.period, dueDate: request.dueDate }

  const response = await client["review-cycles"].$post({ json })

  if (response.status >= 400) {
    return new Error("failed to create review cycle")
  }

  return response.json()
}

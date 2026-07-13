import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ReviewCycleCreateRequest } from "@/lib/api/types/review-types"

// POST /review-cycles。特権ロールが draft の評価サイクルを作成する。
export async function createReviewCycle(request: ReviewCycleCreateRequest) {
  const client = await createClient()

  const json: {
    title: string
    period: string
    dueDate?: string
    policy: ReviewCycleCreateRequest["policy"]
  } =
    request.dueDate === null
      ? { title: request.title, period: request.period, policy: request.policy }
      : {
          title: request.title,
          period: request.period,
          dueDate: request.dueDate,
          policy: request.policy,
        }

  const response = await client["review-cycles"].$post({ json })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "評価サイクルの作成に失敗しました",
    })
  }

  return response.json()
}

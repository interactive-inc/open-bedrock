import { createClient } from "@/lib/api/hc-client"
import type { ReviewCycleResponse } from "@/lib/api/types/review-types"

// GET /review-cycles。評価サイクルの一覧を取得する。
export async function getReviewCycles(): Promise<Array<ReviewCycleResponse> | Error> {
  const client = await createClient()

  const response = await client["review-cycles"].$get()

  if (response.status >= 400) {
    return new Error("failed to load review cycles")
  }

  const body = await response.json()

  return body.data
}

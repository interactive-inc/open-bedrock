import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// POST /review-cycles/:cycle_id/disclose。特権ロールがサイクル内の全フォームを一括開示する。
export async function discloseReviewCycle(cycleId: number) {
  const client = await createClient()

  const response = await client["review-cycles"][":cycle_id"].disclose.$post({
    param: { cycle_id: String(cycleId) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "評価フォームの開示に失敗しました",
    })
  }

  return response.json()
}

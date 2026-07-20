import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ReviewFormBulkItem } from "@/lib/api/types/review-types"

/** POST /review-cycles/:cycle_id/forms/bulk。特権ロールが評価者種別の組を一括作成する（360度評価）。 */
export async function createReviewFormsBulk(cycleId: number, forms: Array<ReviewFormBulkItem>) {
  const client = await createClient()

  const response = await client["review-cycles"][":cycle_id"].forms.bulk.$post({
    param: { cycle_id: String(cycleId) },
    json: { forms },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "評価フォームの一括作成に失敗しました",
    })
  }

  return response.json()
}

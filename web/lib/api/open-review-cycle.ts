import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// POST /review-cycles/:cycle_id/open。特権ロールがサイクルを open にする。
export async function openReviewCycle(cycleId: number) {
  const client = await createClient()

  const response = await client["review-cycles"][":cycle_id"].open.$post({
    param: { cycle_id: String(cycleId) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "評価サイクルの開始に失敗しました",
      conflictMessages: {
        "review cycle cannot be opened from current status":
          "現在の状態ではこの評価サイクルを開始できません",
      },
    })
  }

  return response.json()
}

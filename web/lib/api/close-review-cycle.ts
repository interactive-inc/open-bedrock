import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// POST /review-cycles/:cycle_id/close。特権ロールがサイクルを closed にする。
export async function closeReviewCycle(cycleId: number) {
  const client = await createClient()

  const response = await client["review-cycles"][":cycle_id"].close.$post({
    param: { cycle_id: String(cycleId) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "評価サイクルの締切に失敗しました",
      conflictMessages: {
        "review cycle cannot be closed from current status":
          "現在の状態ではこの評価サイクルを締切できません",
      },
    })
  }

  return response.json()
}

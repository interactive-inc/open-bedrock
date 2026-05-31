import { createClient } from "@/lib/api/hc-client"

// POST /review-cycles/:cycle_id/close。特権ロールがサイクルを closed にする。
export async function closeReviewCycle(cycleId: number) {
  const client = await createClient()

  const response = await client["review-cycles"][":cycle_id"].close.$post({
    param: { cycle_id: String(cycleId) },
  })

  if (response.status >= 400) {
    return new Error("failed to close review cycle")
  }

  return response.json()
}

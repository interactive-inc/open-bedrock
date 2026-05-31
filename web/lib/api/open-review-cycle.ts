import { createClient } from "@/lib/api/hc-client"

// POST /review-cycles/:cycle_id/open。特権ロールがサイクルを open にする。
export async function openReviewCycle(cycleId: number) {
  const client = await createClient()

  const response = await client["review-cycles"][":cycle_id"].open.$post({
    param: { cycle_id: String(cycleId) },
  })

  if (response.status >= 400) {
    return new Error("failed to open review cycle")
  }

  return response.json()
}

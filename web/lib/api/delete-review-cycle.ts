import { createClient } from "@/lib/api/hc-client"

// DELETE /review-cycles/:cycle_id。特権ロールがサイクルを削除する。成功時は null。
export async function deleteReviewCycle(cycleId: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client["review-cycles"][":cycle_id"].$delete({
    param: { cycle_id: String(cycleId) },
  })

  if (response.status >= 400) {
    return new Error("failed to delete review cycle")
  }

  return null
}

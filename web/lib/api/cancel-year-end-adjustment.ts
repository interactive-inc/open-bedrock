import { createClient } from "@/lib/api/hc-client"

// DELETE /year-end-adjustments/:id。年末調整申告を取消する。本人以外は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function cancelYearEndAdjustment(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["year-end-adjustments"][":id"].$delete({
    param: { id },
  })

  if (response.status >= 400) {
    return new Error("failed to cancel year end adjustment")
  }

  return null
}

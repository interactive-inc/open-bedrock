import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// DELETE /year-end-adjustments/:id。年末調整申告を取消する。本人以外は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function cancelYearEndAdjustment(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["year-end-adjustments"][":id"].$delete({
    param: { id },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "年末調整申告の取消に失敗しました",
      conflictMessages: {
        "not modifiable": "この年末調整申告は取消できません",
      },
    })
  }

  return null
}

import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { PositionUpdateRequest } from "@/lib/api/types/position-types"

/**
 * PUT /positions/:id。役職マスタを更新する。
 * 戻りは更新された Position or Error。呼び出し元は instanceof Error で判別する。
 */
export async function updatePosition(positionId: number, request: PositionUpdateRequest) {
  const client = await createClient()

  const response = await client.positions[":id"].$put({
    param: { id: String(positionId) },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "役職の変更に失敗しました",
    })
  }

  return response.json()
}

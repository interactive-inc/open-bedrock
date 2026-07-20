import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { PositionCreateRequest } from "@/lib/api/types/position-types"

/**
 * POST /positions。役職マスタを新規作成する。
 * 戻りは作成された Position or Error。呼び出し元は instanceof Error で判別する。
 */
export async function createPosition(request: PositionCreateRequest) {
  const client = await createClient()

  const response = await client.positions.$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "役職の作成に失敗しました",
    })
  }

  return response.json()
}

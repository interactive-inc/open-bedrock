import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { AssetUpdateRequest } from "@/lib/api/types/asset-types"

// PUT /assets/:code。物品の名称・種別・シリアル・購入日を変更する（管理者ロールのみ）。
// 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。
export async function updateAsset(code: string, request: AssetUpdateRequest) {
  const client = await createClient()

  const response = await client.assets[":code"].$put({ param: { code }, json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "物品の変更に失敗しました",
    })
  }

  return response.json()
}

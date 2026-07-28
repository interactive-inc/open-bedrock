import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { AssetCreateRequest } from "@/lib/api/types/asset-types"

/** POST /assets。物品を新規登録する（管理者ロールのみ）。 */
export async function createAsset(request: AssetCreateRequest) {
  const client = await createClient()

  const response = await client.assets.$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "物品の登録に失敗しました",
      conflictMessages: {
        "asset code already exists": "この物品コードは既に登録されています",
      },
    })
  }

  return response.json()
}

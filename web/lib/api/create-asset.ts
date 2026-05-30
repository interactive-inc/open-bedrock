import { createClient } from "@/lib/api/hc-client"
import type { AssetCreateRequest } from "@/lib/api/types/asset-types"

// POST /assets。物品を新規登録する（管理者ロールのみ）。
export async function createAsset(request: AssetCreateRequest) {
  const client = await createClient()

  const response = await client.assets.$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to create asset")
  }

  return response.json()
}

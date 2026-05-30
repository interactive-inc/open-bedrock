import { createClient } from "@/lib/api/hc-client"
import type { AssetSearchQuery } from "@/lib/api/types/asset-types"

// GET /assets。物品一覧。kind / status で絞り込み可能。
export async function getAssetList(query: AssetSearchQuery) {
  const client = await createClient()

  const response = await client.assets.$get({
    query: { kind: query.kind ?? undefined, status: query.status ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load assets")
  }

  return response.json()
}

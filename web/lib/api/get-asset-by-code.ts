import { createClient } from "@/lib/api/hc-client"

// GET /assets/:code。物品 1 件の詳細。
export async function getAssetByCode(code: string) {
  const client = await createClient()

  const response = await client.assets[":code"].$get({ param: { code } })

  if (response.status >= 400) {
    return new Error("failed to load asset")
  }

  return response.json()
}

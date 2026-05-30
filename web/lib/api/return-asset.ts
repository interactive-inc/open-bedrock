import { createClient } from "@/lib/api/hc-client"

// POST /assets/:code/return。貸与中の物品を返却して在庫へ戻す（管理者ロールのみ）。
export async function returnAsset(code: string) {
  const client = await createClient()

  const response = await client.assets[":code"].return.$post({
    param: { code },
  })

  if (response.status >= 400) {
    return new Error("failed to return asset")
  }

  return response.json()
}

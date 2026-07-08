import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// POST /stocktakes。棚卸しセッションを開始する（管理者ロールのみ）。
export async function startStocktake(name: string, targetDate: string) {
  const client = await createClient()

  const response = await client.stocktakes.$post({
    json: { name, target_date: targetDate },
  })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "棚卸しの開始に失敗しました" })
  }

  return response.json()
}

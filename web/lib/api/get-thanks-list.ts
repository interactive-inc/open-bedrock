import { createClient } from "@/lib/api/hc-client"
import type { ThanksResponse } from "@/lib/api/types/thanks-types"

// GET /thanks。全従業員に公開された感謝のタイムライン（新着順）を取得する。
// API は { data: ThanksResponse[], total: number } を返す。
// 戻りは ThanksResponse 配列 or Error。呼び出し元は instanceof Error で判別する。
export async function getThanksList(): Promise<Array<ThanksResponse> | Error> {
  const client = await createClient()

  const response = await client.thanks.$get({ query: {} })

  if (response.status >= 400) {
    return new Error("failed to load thanks list")
  }

  const body = await response.json()

  return body.data
}

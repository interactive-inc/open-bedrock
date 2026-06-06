import { createClient } from "@/lib/api/hc-client"
import type { ThanksRewardResponse } from "@/lib/api/types/thanks-points-types"

// GET /thanks/rewards。交換カタログ一覧を取得する。
// 戻りは ThanksRewardResponse 配列 or Error。呼び出し元は instanceof Error で判別する。
export async function getThanksRewards(): Promise<Array<ThanksRewardResponse> | Error> {
  const client = await createClient()

  const response = await client.thanks.rewards.$get()

  if (response.status >= 400) {
    return new Error("failed to load thanks rewards")
  }

  return response.json()
}

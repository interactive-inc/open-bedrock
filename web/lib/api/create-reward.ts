import { createClient } from "@/lib/api/hc-client"
import type { ThanksRewardResponse } from "@/lib/api/types/thanks-points-types"

/**
 * POST /thanks/rewards。管理権限が交換カタログを登録する。
 * 戻りは作成された景品 or Error。呼び出し元は instanceof Error で判別する。
 */
export async function createReward(request: {
  name: string
  point_cost: number
  stock: number | null
}): Promise<ThanksRewardResponse | Error> {
  const client = await createClient()

  const response = await client.thanks.rewards.$post({
    json: { name: request.name, point_cost: request.point_cost, stock: request.stock },
  })

  if (response.status >= 400) {
    return new Error("景品の登録に失敗しました")
  }

  return response.json()
}

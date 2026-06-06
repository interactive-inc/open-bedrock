import { createClient } from "@/lib/api/hc-client"
import type { ThanksRedemptionResponse } from "@/lib/api/types/thanks-points-types"

// POST /thanks/redemptions。受領残高から交換を申請する。
// 戻りは作成された交換申請 or Error。呼び出し元は instanceof Error で判別する。
export async function requestRedemption(
  rewardId: number,
): Promise<ThanksRedemptionResponse | Error> {
  const client = await createClient()

  const response = await client.thanks.redemptions.$post({ json: { reward_id: rewardId } })

  if (response.status >= 400) {
    return new Error("failed to request redemption")
  }

  return response.json()
}

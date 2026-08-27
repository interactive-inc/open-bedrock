import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ThanksRedemptionResponse } from "@/lib/api/types/thanks-points-types"

/**
 * POST /thanks-redemptions。受領残高から交換を申請する。
 * 戻りは作成された交換申請 or Error。呼び出し元は instanceof Error で判別する。
 */
export async function requestRedemption(
  rewardId: number,
): Promise<ThanksRedemptionResponse | Error> {
  const client = await createClient()

  const response = await client["thanks"]["thanks-redemptions"].$post({
    json: { reward_id: rewardId },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "ポイント交換の申請に失敗しました",
      conflictMessages: {
        "insufficient balance": "受領ポイントの残高が不足しています",
        "reward out of stock": "この景品は在庫切れです",
        "pending redemption already exists": "保留中の交換申請が既にあります",
        "reward is inactive": "この景品は現在交換できません",
      },
    })
  }

  return response.json()
}

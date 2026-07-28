import { createClient } from "@/lib/api/hc-client"
import type { ThanksBalanceResponse } from "@/lib/api/types/thanks-points-types"

/**
 * GET /thanks-point-balances/me。受領残高（受領 − 確定・未決裁の交換）を取得する。
 * 送れる枠である当月原資は別リソースで、getThanksBudget が担う。
 * 戻りは ThanksBalanceResponse or Error。呼び出し元は instanceof Error で判別する。
 */
export async function getThanksBalance(): Promise<ThanksBalanceResponse | Error> {
  const client = await createClient()

  const response = await client["thanks-point-balances"].me.$get()

  if (response.status >= 400) {
    return new Error("failed to load thanks balance")
  }

  return response.json()
}

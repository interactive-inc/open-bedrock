import { createClient } from "@/lib/api/hc-client"
import type { ThanksBalanceResponse } from "@/lib/api/types/thanks-points-types"

// GET /thanks/balance/me。受領残高（受領 − 確定交換）を取得する。
// 戻りは ThanksBalanceResponse or Error。呼び出し元は instanceof Error で判別する。
export async function getThanksBalance(): Promise<ThanksBalanceResponse | Error> {
  const client = await createClient()

  const response = await client.thanks.balance.me.$get()

  if (response.status >= 400) {
    return new Error("failed to load thanks balance")
  }

  return response.json()
}

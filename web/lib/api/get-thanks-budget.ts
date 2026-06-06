import { createClient } from "@/lib/api/hc-client"
import type { ThanksBudgetResponse } from "@/lib/api/types/thanks-points-types"

// GET /thanks/budget/me。当月の贈与原資（付与・贈与済み・残量）を取得する。
// 戻りは ThanksBudgetResponse or Error。呼び出し元は instanceof Error で判別する。
export async function getThanksBudget(): Promise<ThanksBudgetResponse | Error> {
  const client = await createClient()

  const response = await client.thanks.budget.me.$get()

  if (response.status >= 400) {
    return new Error("failed to load thanks budget")
  }

  return response.json()
}

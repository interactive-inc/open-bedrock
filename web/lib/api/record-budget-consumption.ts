import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export type BudgetConsumptionRequest = {
  amount: number
  recorded_on: string
  note?: string | null
}

// POST /budgets/:id/consumptions。予算枠の消化を手動記録する。失敗時は Error。
export async function recordBudgetConsumption(id: number, request: BudgetConsumptionRequest) {
  const client = await createClient()

  const response = await client.budgets[":id"].consumptions.$post({
    param: { id: String(id) },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "消化の記録に失敗しました" })
  }

  return response.json()
}

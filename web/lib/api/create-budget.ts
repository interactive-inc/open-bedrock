import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export type BudgetCreateRequest = {
  fiscal_year: number
  title: string
  amount: number
  department_code?: string | null
  note?: string | null
}

// POST /budgets。予算枠を新規登録する。失敗時は Error。
export async function createBudget(request: BudgetCreateRequest) {
  const client = await createClient()

  const response = await client.budgets.$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "予算枠の作成に失敗しました" })
  }

  return response.json()
}

import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ExpenseSubmitRequest } from "@/lib/api/types/expense-types"

// POST /expenses。経費を新規申請する。
export async function submitExpense(request: ExpenseSubmitRequest) {
  const client = await createClient()

  const response = await client.expenses.$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "経費申請の作成に失敗しました" })
  }

  return response.json()
}

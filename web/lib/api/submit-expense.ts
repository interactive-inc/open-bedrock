import { createClient } from "@/lib/api/hc-client"
import type { ExpenseSubmitRequest } from "@/lib/api/types/expense-types"

// POST /expenses。経費を新規申請する。
export async function submitExpense(request: ExpenseSubmitRequest) {
  const client = await createClient()

  const response = await client.expenses.$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to submit expense")
  }

  return response.json()
}

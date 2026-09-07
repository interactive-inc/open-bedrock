import { createClient } from "@/lib/api/hc-client"

import type { ExpenseStatus } from "@/lib/api/types/expense-types"

/** GET /expenses/me。自分が申請した経費の一覧。status で絞り込み可能。 */
export async function getMyExpenses(status: ExpenseStatus | null, offset = 0) {
  const client = await createClient()

  const response = await client["expense"]["expenses"].me.$get({
    query: { status: status ?? undefined, limit: "20", offset: String(offset) },
  })

  if (response.status >= 400) {
    return new Error("failed to load my expenses")
  }

  const body = await response.json()
  return body
}

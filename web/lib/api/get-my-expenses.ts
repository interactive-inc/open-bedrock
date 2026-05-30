import { createClient } from "@/lib/api/hc-client"

type ExpenseStatus = "pending" | "approved" | "rejected" | "settled"

// GET /expenses/me。自分が申請した経費の一覧。status で絞り込み可能。
export async function getMyExpenses(status: ExpenseStatus | null) {
  const client = await createClient()

  const response = await client.expenses.me.$get({
    query: { status: status ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load my expenses")
  }

  return response.json()
}

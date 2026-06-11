import { createClient } from "@/lib/api/hc-client"

// GET /expenses/inbox。承認者向けの承認待ち経費一覧。
export async function getExpenseInbox() {
  const client = await createClient()

  const response = await client.expenses.inbox.$get()

  if (response.status >= 400) {
    return new Error("failed to load expense inbox")
  }

  const body = await response.json()
  return body.data
}

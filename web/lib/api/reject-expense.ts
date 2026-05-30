import { createClient } from "@/lib/api/hc-client"

// POST /expenses/:id/reject。理由コメント必須で経費を却下する。
export async function rejectExpense(id: number, comment: string) {
  const client = await createClient()

  const response = await client.expenses[":id"].reject.$post({
    param: { id: String(id) },
    json: { comment: comment },
  })

  if (response.status >= 400) {
    return new Error("failed to reject expense")
  }

  return response.json()
}

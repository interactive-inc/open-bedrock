import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// POST /expenses/:id/reject。理由コメント必須で経費を却下する。
export async function rejectExpense(id: number, comment: string) {
  const client = await createClient()

  const response = await client.expenses[":id"].reject.$post({
    param: { id: String(id) },
    json: { comment: comment },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "経費申請の却下に失敗しました",
      conflictMessages: {
        "already decided": "この経費申請は既に決定済みです",
      },
    })
  }

  return response.json()
}

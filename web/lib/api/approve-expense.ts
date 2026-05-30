import { createClient } from "@/lib/api/hc-client"

// POST /expenses/:id/approve。任意コメント付きで経費を承認する。
export async function approveExpense(id: number, comment: string | null) {
  const client = await createClient()

  const response = await client.expenses[":id"].approve.$post({
    param: { id: String(id) },
    json: { comment: comment },
  })

  if (response.status >= 400) {
    return new Error("failed to approve expense")
  }

  return response.json()
}

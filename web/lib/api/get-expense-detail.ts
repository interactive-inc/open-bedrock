import { createClient } from "@/lib/api/hc-client"

// GET /expenses/:id。1 件の経費詳細を取得する。
export async function getExpenseDetail(id: number) {
  const client = await createClient()

  const response = await client.expenses[":id"].$get({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new Error("failed to load expense detail")
  }

  return response.json()
}

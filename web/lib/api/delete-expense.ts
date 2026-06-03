import { createClient } from "@/lib/api/hc-client"

// DELETE /expenses/:id。経費の申請を取り下げる。
// 本人以外は 403、pending 以外は 409、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function deleteExpense(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.expenses[":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new Error("failed to delete expense")
  }

  return null
}

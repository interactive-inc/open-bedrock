import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * DELETE /expenses/:id。経費の申請を取り下げる。
 * 本人以外は 403、pending 以外は 409、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function deleteExpense(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client["expense"]["expenses"][":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "経費申請の取り下げに失敗しました",
      conflictMessages: {
        "the expense is not deletable": "この経費申請は取り下げできません",
      },
    })
  }

  return null
}

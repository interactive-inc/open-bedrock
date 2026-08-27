import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /expenses/:id/approve。任意コメント付きで経費を承認する。 */
export async function approveExpense(id: number, comment: string | null) {
  const client = await createClient()

  const response = await client["expense"]["expenses"][":id"].approve.$post({
    param: { id: String(id) },
    json: { comment: comment },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "経費申請の承認に失敗しました",
      conflictMessages: {
        "already decided": "この経費申請は既に決定済みです",
      },
    })
  }

  return response.json()
}

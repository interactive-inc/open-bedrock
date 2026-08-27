import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /ringi-requests/:id/approve。任意コメント付きで稟議を承認する。指名された承認者本人のみ許可される。 */
export async function approveRingi(id: number, comment: string | null) {
  const client = await createClient()

  const response = await client["ringi"]["ringi-requests"][":id"].approve.$post({
    param: { id: String(id) },
    json: { comment: comment },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "稟議の承認に失敗しました",
      conflictMessages: {
        "ringi request already decided": "この稟議は既に決定済みです",
      },
    })
  }

  return response.json()
}

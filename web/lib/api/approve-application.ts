import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /application-requests/:id/approve。任意コメント付きで申請を承認する。 */
export async function approveApplication(id: number, comment: string | null) {
  const client = await createClient()

  const response = await client["company"]["application-requests"][":id"].approve.$post({
    param: { id: String(id) },
    json: { comment: comment },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "申請の承認に失敗しました",
      conflictMessages: {
        "already decided": "この申請は既に審査済みです",
      },
    })
  }

  return response.json()
}

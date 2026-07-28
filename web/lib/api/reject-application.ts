import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /application-requests/:id/reject。コメント必須で申請を却下する。 */
export async function rejectApplication(id: number, comment: string) {
  const client = await createClient()

  const response = await client["application-requests"][":id"].reject.$post({
    param: { id: String(id) },
    json: { comment: comment },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "申請の却下に失敗しました",
      conflictMessages: {
        "already decided": "この申請は既に審査済みです",
      },
    })
  }

  return response.json()
}

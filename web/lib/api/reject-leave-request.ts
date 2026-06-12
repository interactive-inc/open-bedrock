import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// POST /leave/requests/:id/reject。却下理由コメント必須で休暇申請を却下する。
export async function rejectLeaveRequest(id: number, comment: string) {
  const client = await createClient()

  const response = await client.leave.requests[":id"].reject.$post({
    param: { id: String(id) },
    json: { comment: comment },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "休暇申請の却下に失敗しました",
      conflictMessages: {
        "leave request already decided": "この休暇申請は既に決定済みです",
      },
    })
  }

  return response.json()
}

import type { LeaveRequestInboxResponse } from "@/lib/api/types/leave-types"
import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /leave-requests/:id/reject。却下理由コメント必須で休暇申請を却下する。 */
export async function rejectLeaveRequest(
  id: number,
  comment: string,
  target: LeaveRequestInboxResponse["decision_target"],
) {
  const client = await createClient()

  const response = await client["leave"]["leave-requests"][":id"].reject.$post({
    param: { id: String(id) },
    json: { comment, decision_target: target },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "休暇申請の却下に失敗しました",
      conflictMessages: {
        "the leave request changed; review it again":
          "申請内容が更新されています。画面を再読み込みし、内容を確認し直してください",
        "the leave request is already decided": "この休暇申請は既に決定済みです",
      },
    })
  }

  return response.json()
}

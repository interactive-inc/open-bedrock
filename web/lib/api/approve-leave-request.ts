import type { LeaveRequestInboxResponse } from "@/lib/api/types/leave-types"
import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /leave-requests/:id/approve。任意コメント付きで休暇申請を承認する。 */
export async function approveLeaveRequest(
  id: number,
  comment: string | null,
  target: LeaveRequestInboxResponse["decision_target"],
) {
  const client = await createClient()

  const response = await client["leave"]["leave-requests"][":id"].approve.$post({
    param: { id: String(id) },
    json: { comment, decision_target: target },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "休暇申請の承認に失敗しました",
      conflictMessages: {
        "the leave request changed; review it again":
          "申請内容が更新されています。画面を再読み込みし、内容を確認し直してください",
        "the leave request is already decided": "この休暇申請は既に決定済みです",
        "leave balance record not found": "有給休暇の残日数情報が見つかりません",
        "insufficient leave balance": "有給休暇の残日数が不足しています",
      },
    })
  }

  return response.json()
}

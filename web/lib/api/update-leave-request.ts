import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type {
  LeaveRequestDetailResponse,
  LeaveRequestUpdateRequest,
} from "@/lib/api/types/leave-types"

/**
 * PUT /leave-requests/:id。休暇申請の内容を変更する。
 * 本人以外は 403、決定済みは 409 を api が返すため、戻りは Error になる。
 */
export async function updateLeaveRequest(
  id: number,
  request: LeaveRequestUpdateRequest,
): Promise<LeaveRequestDetailResponse | Error> {
  const client = await createClient()

  const response = await client["leave"]["leave-requests"][":id"].$put({
    param: { id: String(id) },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "休暇申請の変更に失敗しました",
      conflictMessages: {
        "an overlapping leave request already exists": "期間が重複する休暇申請が既にあります",
        "the leave request is already decided": "決定済みの休暇申請は変更できません",
        "leave balance record not found": "この休暇種別の残日数が登録されていません",
        "insufficient leave balance": "残日数が不足しているため変更できません",
      },
    })
  }

  return response.json()
}

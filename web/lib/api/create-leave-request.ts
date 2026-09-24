import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { EntityId } from "@/lib/api/types/entity-id"
import type { LeaveRequestCreateRequest } from "@/lib/api/types/leave-types"

/** POST /leave-requests。休暇申請を作成する。 */
export async function createLeaveRequest(
  request: Omit<LeaveRequestCreateRequest, "previous_leave_request_id"> & {
    previous_leave_request_id?: EntityId | null
  },
) {
  const client = await createClient()

  const previousId = request.previous_leave_request_id

  const response = await client["leave"]["leave-requests"].$post({
    json: {
      ...request,
      previous_leave_request_id: previousId == null ? previousId : Number(previousId),
    },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "休暇申請の作成に失敗しました",
      conflictMessages: {
        "an overlapping leave request already exists": "期間が重複する休暇申請が既にあります",
        "leave balance record not found": "この休暇種別の残日数が登録されていません",
        "insufficient leave balance": "残日数が不足しているため申請できません",
      },
    })
  }

  return response.json()
}

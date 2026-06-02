import { createClient } from "@/lib/api/hc-client"
import type {
  LeaveRequestDetailResponse,
  LeaveRequestUpdateRequest,
} from "@/lib/api/types/leave-types"

// PUT /leave/requests/:id。休暇申請の内容を変更する。
// 本人以外は 403、決定済みは 409 を api が返すため、戻りは Error になる。
export async function updateLeaveRequest(
  id: number,
  request: LeaveRequestUpdateRequest,
): Promise<LeaveRequestDetailResponse | Error> {
  const client = await createClient()

  const response = await client.leave.requests[":id"].$put({
    param: { id: String(id) },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to update leave request")
  }

  return response.json()
}

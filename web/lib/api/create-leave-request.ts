import { createClient } from "@/lib/api/hc-client"
import type { LeaveRequestCreateRequest } from "@/lib/api/types/leave-types"

// POST /leave/requests。休暇申請を作成する。
export async function createLeaveRequest(request: LeaveRequestCreateRequest) {
  const client = await createClient()

  const response = await client.leave.requests.$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to create leave request")
  }

  return response.json()
}

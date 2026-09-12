import { createClient } from "@/lib/api/hc-client"

import type { LeaveStatus } from "@/lib/api/types/leave-types"

/** GET /leave-requests/me。自分の休暇申請一覧。status は任意で絞り込みに使う。 */
export async function getMyLeaveRequests(status: LeaveStatus | null) {
  const client = await createClient()

  const response = await client["leave"]["leave-requests"].me.$get({
    query: { status: status ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load my leave requests")
  }

  const body = await response.json()

  return body.data
}

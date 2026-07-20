import { createClient } from "@/lib/api/hc-client"

type LeaveStatus = "pending" | "approved" | "rejected"

/** GET /leave/requests/me。自分の休暇申請一覧。status は任意で絞り込みに使う。 */
export async function getMyLeaveRequests(status: LeaveStatus | null) {
  const client = await createClient()

  const response = await client.leave.requests.me.$get({
    query: { status: status ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load my leave requests")
  }

  const body = await response.json()

  return body.data
}

import { createClient } from "@/lib/api/hc-client"
import type { LeaveStatus, LeaveType } from "@/lib/api/types/leave-types"

export type LeaveAdminSort =
  | "created_at_desc"
  | "created_at_asc"
  | "start_date_desc"
  | "start_date_asc"

export type LeaveAdminFilter = {
  status: LeaveStatus | null
  applicantId: number | null
  leaveType: LeaveType | null
  from: string | null
  to: string | null
}

type Params = {
  limit?: number
  offset?: number
  sort?: LeaveAdminSort
}

/** GET /leave/requests/admin。全社の休暇申請を横断で取得する。leave:read:all が無いと 403。 */
export async function getLeaveAdminList(filter: LeaveAdminFilter, params: Params = {}) {
  const client = await createClient()

  const response = await client.leave.requests.admin.$get({
    query: {
      status: filter.status ?? undefined,
      applicant_id: filter.applicantId !== null ? String(filter.applicantId) : undefined,
      leave_type: filter.leaveType ?? undefined,
      from: filter.from ?? undefined,
      to: filter.to ?? undefined,
      sort: params.sort,
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      offset: params.offset !== undefined ? String(params.offset) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load leave admin list")
  }

  return response.json()
}

import { createClient } from "@/lib/api/hc-client"

export type RedemptionAdminSort = "created_at_desc" | "created_at_asc"

export type RedemptionStatus = "pending" | "rejected" | "fulfilled"

export type RedemptionAdminFilter = {
  status: RedemptionStatus | null
  employeeId: number | null
  rewardId: number | null
  from: string | null
  to: string | null
}

type Params = {
  limit?: number
  offset?: number
  sort?: RedemptionAdminSort
}

// GET /thanks/redemptions/admin。全社のサンクス交換申請を横断で取得する。
// thanks_redemption:read:all が無いと 403。
export async function getRedemptionAdminList(filter: RedemptionAdminFilter, params: Params = {}) {
  const client = await createClient()

  const response = await client.thanks.redemptions.admin.$get({
    query: {
      status: filter.status ?? undefined,
      employee_id: filter.employeeId !== null ? String(filter.employeeId) : undefined,
      reward_id: filter.rewardId !== null ? String(filter.rewardId) : undefined,
      from: filter.from ?? undefined,
      to: filter.to ?? undefined,
      sort: params.sort,
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      offset: params.offset !== undefined ? String(params.offset) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load redemption admin list")
  }

  return response.json()
}

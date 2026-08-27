import { createClient } from "@/lib/api/hc-client"

export type ShiftSwapAdminSort = "date_desc" | "date_asc" | "id_desc" | "id_asc"

export type ShiftSwapAdminFilter = {
  status: string | null
  requesterId: string | null
  targetId: string | null
  from: string | null
  to: string | null
}

type Params = {
  limit?: number
  offset?: number
  sort?: ShiftSwapAdminSort
}

/**
 * GET /shift-swap-requests/admin。全社のシフト交代申請を横断で取得する。
 * shift_swap:read:all が無いと 403。
 */
export async function getShiftSwapAdminList(filter: ShiftSwapAdminFilter, params: Params = {}) {
  const client = await createClient()

  const response = await client["shift"]["shift-swap-requests"].admin.$get({
    query: {
      status: filter.status ?? undefined,
      requester_id: filter.requesterId !== null ? String(filter.requesterId) : undefined,
      target_id: filter.targetId !== null ? String(filter.targetId) : undefined,
      from: filter.from ?? undefined,
      to: filter.to ?? undefined,
      sort: params.sort,
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      offset: params.offset !== undefined ? String(params.offset) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load shift swap admin list")
  }

  return response.json()
}

import { createClient } from "@/lib/api/hc-client"

export type FamilyCareLeaveAdminFilter = {
  status: string | null
  employeeId: number | null
}

type Params = {
  limit?: number
  offset?: number
}

// GET /family-care-leaves/admin。全社の産休・育休・介護休業の申出を横断で取得する。family_care_leave:read:all が無いと 403。
export async function getFamilyCareLeaveAdminList(
  filter: FamilyCareLeaveAdminFilter,
  params: Params = {},
) {
  const client = await createClient()

  const response = await client["family-care-leaves"].admin.$get({
    query: {
      status: filter.status ?? undefined,
      employee_id: filter.employeeId !== null ? String(filter.employeeId) : undefined,
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      offset: params.offset !== undefined ? String(params.offset) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load family care leave admin list")
  }

  return response.json()
}

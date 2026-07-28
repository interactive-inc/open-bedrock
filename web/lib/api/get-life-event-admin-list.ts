import { createClient } from "@/lib/api/hc-client"

export type LifeEventAdminFilter = {
  status: string | null
  employeeId: number | null
}

type Params = {
  limit?: number
  offset?: number
}

/** GET /life-events/admin。全社のライフイベント届を横断で取得する。life_event:read:all が無いと 403。 */
export async function getLifeEventAdminList(filter: LifeEventAdminFilter, params: Params = {}) {
  const client = await createClient()

  const response = await client["life-events"].admin.$get({
    query: {
      status: filter.status ?? undefined,
      employee_id: filter.employeeId !== null ? String(filter.employeeId) : undefined,
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      offset: params.offset !== undefined ? String(params.offset) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load life event admin list")
  }

  return response.json()
}

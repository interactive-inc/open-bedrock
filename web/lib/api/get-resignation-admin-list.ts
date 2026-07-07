import { createClient } from "@/lib/api/hc-client"

export type ResignationAdminFilter = {
  status: string | null
  employeeId: number | null
}

type Params = {
  limit?: number
  offset?: number
}

// GET /resignations/admin。全社の退職手続きを横断で取得する。resignation:read:all が無いと 403。
export async function getResignationAdminList(filter: ResignationAdminFilter, params: Params = {}) {
  const client = await createClient()

  const response = await client.resignations.admin.$get({
    query: {
      status: filter.status ?? undefined,
      employee_id: filter.employeeId !== null ? String(filter.employeeId) : undefined,
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      offset: params.offset !== undefined ? String(params.offset) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load resignation admin list")
  }

  return response.json()
}

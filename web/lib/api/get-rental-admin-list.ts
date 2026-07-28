import { createClient } from "@/lib/api/hc-client"

export type RentalAdminFilter = {
  status: string | null
  employeeId: number | null
}

type Params = {
  limit?: number
  offset?: number
}

/** GET /rental-reservations/admin。全社の貸与品予約を横断で取得する。rental:read:all が無いと 403。 */
export async function getRentalAdminList(filter: RentalAdminFilter, params: Params = {}) {
  const client = await createClient()

  const response = await client["rental-reservations"].admin.$get({
    query: {
      status: filter.status ?? undefined,
      employee_id: filter.employeeId !== null ? String(filter.employeeId) : undefined,
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      offset: params.offset !== undefined ? String(params.offset) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load rental admin list")
  }

  return response.json()
}

import { createClient } from "@/lib/api/hc-client"
import type { RingiStatus } from "@/lib/api/types/ringi-types"

export type RingiAdminSort = "created_at_desc" | "created_at_asc" | "amount_desc" | "amount_asc"

export type RingiAdminFilter = {
  status: RingiStatus | null
  applicantId: number | null
}

type Params = {
  limit?: number
  offset?: number
  sort?: RingiAdminSort
}

/** GET /ringi-requests/admin。全社の稟議を横断で取得する。ringi:read:all が無いと 403。 */
export async function getRingiAdminList(filter: RingiAdminFilter, params: Params = {}) {
  const client = await createClient()

  const response = await client["ringi-requests"].admin.$get({
    query: {
      status: filter.status ?? undefined,
      applicant_id: filter.applicantId !== null ? String(filter.applicantId) : undefined,
      sort: params.sort,
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      offset: params.offset !== undefined ? String(params.offset) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load ringi admin list")
  }

  return response.json()
}

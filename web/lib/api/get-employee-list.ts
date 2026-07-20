import { createClient } from "@/lib/api/hc-client"
import type { EmployeeListItem } from "@/lib/api/types/employee-list-item"
import type { EmployeeSearchFilter } from "@/lib/api/types/employee-search-filter"

type Params = {
  limit?: number
  offset?: number
}

/**
 * GET /employees を session トークン付きで呼び、絞り込み済みの従業員一覧を返す。
 * 絞り込み条件 q / dept / status は null のとき送信されない。
 * api は snake_case を返すため、この関数内で camelCase の EmployeeListItem に変換する。
 */
export async function getEmployeeList(filter: EmployeeSearchFilter, params: Params = {}) {
  const client = await createClient()

  const response = await client.employees.$get({
    query: {
      q: filter.q ?? undefined,
      dept: filter.dept ?? undefined,
      status: filter.status ?? undefined,
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      offset: params.offset !== undefined ? String(params.offset) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load employees")
  }

  const body = await response.json()

  return {
    items: body.data.map(toEmployeeListItem),
    total: body.total,
  }
}

/** snake_case の生レスポンスを公開 type へ変換する。 */
function toEmployeeListItem(raw: {
  code: string
  name: string
  dept_name: string | null
  position: string | null
  email: string
  status: string
}): EmployeeListItem {
  return {
    code: raw.code,
    name: raw.name,
    deptName: raw.dept_name,
    position: raw.position,
    email: raw.email,
    status: raw.status,
  }
}

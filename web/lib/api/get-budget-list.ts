import { createClient } from "@/lib/api/hc-client"

// GET /budgets を session トークン付きで呼び、予算枠一覧（消化合計・残額つき）を取得する。
export async function getBudgetList(query: {
  fiscalYear?: string
  departmentCode?: string
  limit: number
  offset: number
}) {
  const client = await createClient()

  const response = await client.budgets.$get({
    query: {
      fiscal_year: query.fiscalYear,
      department_code: query.departmentCode,
      limit: String(query.limit),
      offset: String(query.offset),
    },
  })

  if (!response.ok) {
    return new Error("failed to load budgets")
  }

  const body = await response.json()

  return { data: body.data, total: body.total }
}

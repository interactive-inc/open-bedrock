import { createClient } from "@/lib/api/hc-client"

export type SalaryRevisionSearchQuery = {
  employeeCode?: string
  employeeId?: string
}

/**
 * GET /salary-revisions を session トークン付きで呼び、社員の給与改定履歴を取得する。
 * 最機微のため salary_revision:read:all が無ければ api が 403 を返し、ここでは Error を返す。
 */
export async function getSalaryRevisionList(query: SalaryRevisionSearchQuery) {
  const client = await createClient()

  const response = await client["compensation-change"]["salary-revisions"].$get({
    query: {
      employee_code: query.employeeCode,
      employee_id: query.employeeId !== undefined ? String(query.employeeId) : undefined,
    },
  })

  if (!response.ok) {
    return new Error("failed to load salary revisions")
  }

  const body = await response.json()

  return body.data
}

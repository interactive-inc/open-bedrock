import { createClient } from "@/lib/api/hc-client"
import type { EmployeeGradeSearchQuery } from "@/lib/api/types/grade-types"

/**
 * GET /grades/assignments。従業員コード指定で等級付与履歴を取得する。
 * 権限がない場合 api は 403 を返すため、その場合も Error を返し呼び出し元でセクションを隠す。
 */
export async function getEmployeeGradeList(query: EmployeeGradeSearchQuery) {
  const client = await createClient()

  const response = await client.grades.assignments.$get({
    query: { employee_code: query.employeeCode },
  })

  if (response.status >= 400) {
    return new Error("failed to load employee grades")
  }

  const body = await response.json()

  return body.data
}

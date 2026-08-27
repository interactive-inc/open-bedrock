import { createClient } from "@/lib/api/hc-client"
import type { EmployeeEventSearchQuery } from "@/lib/api/types/employee-event-types"

/**
 * GET /employee-events。従業員コード指定で異動・在籍履歴を取得する。kind で絞り込める。
 * 権限がない場合 api は 403 を返すため、その場合も Error を返し呼び出し元でセクションを隠す。
 */
export async function getEmployeeEventList(query: EmployeeEventSearchQuery) {
  const client = await createClient()

  const response = await client.company["employee-events"].$get({
    query: {
      employee_code: query.employeeCode,
      kind: query.kind ?? undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load employee events")
  }

  const body = await response.json()

  return body.data
}

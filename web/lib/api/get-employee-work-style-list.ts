import { createClient } from "@/lib/api/hc-client"
import type { WorkStyleSearchQuery } from "@/lib/api/types/work-style-types"

/**
 * GET /employee-work-styles。従業員コード指定で勤務形態一覧を取得する。
 * 閲覧権限（本人 or work_style:read:all）がない場合 api は 403 を返すため、その場合も Error を返す。
 */
export async function getEmployeeWorkStyleList(query: WorkStyleSearchQuery) {
  const client = await createClient()

  const response = await client["employee-work-styles"].$get({
    query: { employee_code: query.employeeCode },
  })

  if (response.status >= 400) {
    return new Error("failed to load employee work styles")
  }

  const body = await response.json()

  return body.data
}

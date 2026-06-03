import { createClient } from "@/lib/api/hc-client"
import type { EmployeeUpdateRequest } from "@/lib/api/types/employee-types"

// PUT /employees/:code。従業員の氏名・メール・ロール・部署・役職・在籍状況を変更する（権限が必要）。
// 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。
export async function updateEmployee(code: string, request: EmployeeUpdateRequest) {
  const client = await createClient()

  const response = await client.employees[":code"].$put({
    param: { code },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to update employee")
  }

  return response.json()
}

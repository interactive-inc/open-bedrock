import { createClient } from "@/lib/api/hc-client"
import type { EmployeeCreateRequest } from "@/lib/api/types/employee-types"

// POST /employees。従業員を新規登録する（権限が必要）。
// 権限不足は 403、コード重複は 409 を api が返すため、戻りは Error になる。
export async function createEmployee(request: EmployeeCreateRequest) {
  const client = await createClient()

  const response = await client.employees.$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to create employee")
  }

  return response.json()
}

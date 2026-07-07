import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { EmployeeEventCreateRequest } from "@/lib/api/types/employee-event-types"

// POST /employee-events。異動・在籍イベントを記録する。
// 戻りは作成されたイベント or Error。呼び出し元は instanceof Error で判別する。
export async function createEmployeeEvent(request: EmployeeEventCreateRequest) {
  const client = await createClient()

  const response = await client["employee-events"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "異動・在籍イベントの記録に失敗しました",
    })
  }

  return response.json()
}

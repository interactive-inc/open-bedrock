import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { EmployeeGradeCreateRequest } from "@/lib/api/types/grade-types"

// POST /grades/assignments。従業員に等級を付与する。
// 戻りは作成された付与レコード or Error。呼び出し元は instanceof Error で判別する。
export async function createEmployeeGrade(request: EmployeeGradeCreateRequest) {
  const client = await createClient()

  const response = await client.grades.assignments.$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "等級の付与に失敗しました",
    })
  }

  return response.json()
}

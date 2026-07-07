import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { GradeUpdateRequest } from "@/lib/api/types/grade-types"

// PUT /grades/:id。等級マスタを更新する。
// 戻りは更新された Grade or Error。呼び出し元は instanceof Error で判別する。
export async function updateGrade(gradeId: number, request: GradeUpdateRequest) {
  const client = await createClient()

  const response = await client.grades[":id"].$put({
    param: { id: String(gradeId) },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "等級の変更に失敗しました",
    })
  }

  return response.json()
}

import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// DELETE /grades/:id。等級マスタを削除する。成功時（204）は null、失敗時は Error。
export async function deleteGrade(gradeId: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.grades[":id"].$delete({
    param: { id: String(gradeId) },
  })

  if (response.status !== 204) {
    return toResponseError(response, {
      fallback: "等級の削除に失敗しました",
    })
  }

  return null
}

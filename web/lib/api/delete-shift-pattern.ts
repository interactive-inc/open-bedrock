import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** DELETE /shift-patterns/:id。特権ロールがシフトパターンを削除する。成功時は null。 */
export async function deleteShiftPattern(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client["shift-patterns"][":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "シフトパターンの削除に失敗しました",
      conflictMessages: {
        "pattern is in use by assignments": "割当で使用中のシフトパターンは削除できません",
      },
    })
  }

  return null
}

import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** DELETE /shift-assignments/:id。特権ロールが割当を削除する。成功時は null。 */
export async function deleteShiftAssignment(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client["shift-assignments"][":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "シフト割当の削除に失敗しました",
      conflictMessages: {
        "shift assignment is already published": "公開済みのシフト割当は削除できません",
      },
    })
  }

  return null
}

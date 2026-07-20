import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** DELETE /business-trips/:id。出張申請を取消する。本人以外は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。 */
export async function cancelBusinessTrip(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["business-trips"][":id"].$delete({
    param: { id },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "出張申請の取消に失敗しました",
      conflictMessages: {
        "not modifiable": "この出張申請は取消できません",
      },
    })
  }

  return null
}

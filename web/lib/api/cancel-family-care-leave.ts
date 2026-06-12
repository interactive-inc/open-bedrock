import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// DELETE /family-care-leaves/:id。休業申出を取消する。本人以外は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function cancelFamilyCareLeave(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["family-care-leaves"][":id"].$delete({
    param: { id },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "休業申出の取消に失敗しました",
      conflictMessages: {
        "not modifiable": "この休業申出は取消できません",
      },
    })
  }

  return null
}

import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** DELETE /life-events/:id。ライフイベント届出を取消する。本人以外は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。 */
export async function cancelLifeEvent(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["life-events"][":id"].$delete({
    param: { id },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "ライフイベント届出の取消に失敗しました",
      conflictMessages: {
        "not modifiable": "このライフイベント届出は取消できません",
      },
    })
  }

  return null
}

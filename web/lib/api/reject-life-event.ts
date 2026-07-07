import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// POST /life-events/:id/reject。ライフイベント届出を却下する。
// 権限なしは 403、不存在は 404、遷移不可は 409 を api が返すため、戻りは Error になる。成功時は null。
export async function rejectLifeEvent(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["life-events"][":id"].reject.$post({
    param: { id },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "ライフイベント届出の却下に失敗しました",
      conflictMessages: {
        "life event is not in a transitionable state": "この届出は却下できません",
      },
    })
  }

  return null
}

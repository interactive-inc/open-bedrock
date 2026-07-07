import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// POST /life-events/:id/approve。ライフイベント届出を承認する。
// 権限なしは 403、不存在は 404、遷移不可は 409 を api が返すため、戻りは Error になる。成功時は null。
export async function approveLifeEvent(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["life-events"][":id"].approve.$post({
    param: { id },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "ライフイベント届出の承認に失敗しました",
      conflictMessages: {
        "life event is not in a transitionable state": "この届出は承認できません",
      },
    })
  }

  return null
}

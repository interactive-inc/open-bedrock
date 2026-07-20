import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { LifeEventResponse, LifeEventUpdateRequest } from "@/lib/api/types/life-event-types"

/** PUT /life-events/:id。ライフイベント届出の内容を変更する。本人以外は 403 を api が返すため、戻りは Error になる。 */
export async function updateLifeEvent(
  id: string,
  request: LifeEventUpdateRequest,
): Promise<LifeEventResponse | Error> {
  const client = await createClient()

  const response = await client["life-events"][":id"].$put({
    param: { id },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "ライフイベント届出の変更に失敗しました",
      conflictMessages: {
        "not modifiable": "このライフイベント届出は変更できません",
      },
    })
  }

  return response.json()
}

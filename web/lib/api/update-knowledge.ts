import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { KnowledgeUpdateRequest } from "@/lib/api/types/knowledge-types"

/** PUT /knowledge-articles/:id。記事を更新する。作成者以外は 403、不存在は 404 を api が返すため戻りは Error。 */
export async function updateKnowledge(
  id: number,
  request: KnowledgeUpdateRequest,
  confirmation: { revision: number; commandId: string },
) {
  const client = await createClient()

  const response = await client["knowledge"]["knowledge-articles"][":id"].$put({
    param: { id: String(id) },
    json: request,
    header: { "if-match": `"${confirmation.revision}"`, "idempotency-key": confirmation.commandId },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "ナレッジ記事の更新に失敗しました",
    })
  }

  return response.json()
}

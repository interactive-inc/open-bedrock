import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** 本文と同じ閲覧範囲で、過去の版・記録理由・記録者を取得する。 */
export async function getKnowledgeHistory(id: number, offset = 0) {
  const client = await createClient()
  const response = await client.knowledge["knowledge-articles"][":id"].revisions.$get({
    param: { id: String(id) },
    query: { limit: "20", offset: String(offset) },
  })
  if (response.status >= 400)
    return toResponseError(response, { fallback: "改訂履歴を取得できませんでした" })
  return response.json()
}

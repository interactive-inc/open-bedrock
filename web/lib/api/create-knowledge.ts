import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { KnowledgeCreateRequest } from "@/lib/api/types/knowledge-types"

/** POST /knowledge-articles。ナレッジ記事を作成する。失敗時は Error。 */
export async function createKnowledge(request: KnowledgeCreateRequest, commandId: string) {
  const client = await createClient()

  const response = await client["knowledge"]["knowledge-articles"].$post({
    json: request,
    header: { "idempotency-key": commandId },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "ナレッジ記事の作成に失敗しました",
    })
  }

  return response.json()
}

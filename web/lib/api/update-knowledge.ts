import { createClient } from "@/lib/api/hc-client"
import type { KnowledgeUpdateRequest } from "@/lib/api/types/knowledge-types"

// PUT /knowledge/:id。記事を更新する。作成者以外は 403、不存在は 404 を api が返すため戻りは Error。
export async function updateKnowledge(id: number, request: KnowledgeUpdateRequest) {
  const client = await createClient()

  const response = await client.knowledge[":id"].$put({
    param: { id: String(id) },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to update knowledge")
  }

  return response.json()
}

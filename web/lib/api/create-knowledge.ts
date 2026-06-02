import { createClient } from "@/lib/api/hc-client"
import type { KnowledgeCreateRequest } from "@/lib/api/types/knowledge-types"

// POST /knowledge。ナレッジ記事を作成する。失敗時は Error。
export async function createKnowledge(request: KnowledgeCreateRequest) {
  const client = await createClient()

  const response = await client.knowledge.$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to create knowledge")
  }

  return response.json()
}

import { createClient } from "@/lib/api/hc-client"

// GET /knowledge/:id を session トークン付きで呼び、記事詳細を取得する。
export async function getKnowledgeDetail(id: number) {
  const client = await createClient()

  const response = await client.knowledge[":id"].$get({
    param: { id: String(id) },
  })

  if (!response.ok) {
    return new Error("failed to load knowledge detail")
  }

  return response.json()
}

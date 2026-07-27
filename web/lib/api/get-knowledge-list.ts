import { createClient } from "@/lib/api/hc-client"
import type { KnowledgeSearchQuery } from "@/lib/api/types/knowledge-types"

/**
 * GET /knowledge-articles を session トークン付きで呼び、ナレッジ検索結果を取得する。
 * 検索語 q とカテゴリ category は null のとき送信されない。
 */
export async function getKnowledgeList(
  query: KnowledgeSearchQuery & { limit: number; offset: number },
) {
  const client = await createClient()

  const response = await client["knowledge-articles"].$get({
    query: {
      q: query.q ?? undefined,
      category: query.category ?? undefined,
      limit: String(query.limit),
      offset: String(query.offset),
    },
  })

  if (!response.ok) {
    return new Error("failed to load knowledge")
  }

  const body = await response.json()

  return { data: body.data, total: body.total }
}

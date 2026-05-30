import type { KnowledgeArticle } from "@/domain/knowledge/knowledge-article"
import type { KnowledgeSearchQuery } from "@/domain/knowledge/knowledge-search-query"

// 記事が検索条件（カテゴリ一致＋キーワードの全文部分一致）を満たすか判定する純粋関数。
export function matchesKnowledgeQuery(
  article: KnowledgeArticle,
  query: KnowledgeSearchQuery,
): boolean {
  if (query.category !== null && article.category !== query.category) {
    return false
  }

  if (query.q !== null) {
    const keyword = query.q.toLowerCase()

    const haystack = `${article.title} ${article.bodyMd} ${article.tags ?? ""}`.toLowerCase()

    if (haystack.includes(keyword) === false) {
      return false
    }
  }

  return true
}

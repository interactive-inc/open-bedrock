/**
 * GET /knowledge-articles のクエリ。未指定は null で表す。
 * api/src/knowledge/knowledge-search-request-schema.ts と同形。
 */
export type KnowledgeSearchQuery = {
  q: string | null
  category: string | null
}

/**
 * GET /knowledge-articles の一覧要素（レスポンスは { data, total } で包まれ data の各要素）。
 * api は snake_case で返し、interface/knowledge/route.ts の responseBody は
 * id/category/title/snippet に加えて author_id/created_at を含む。
 * id は knowledgeArticles.id（schema 上 integer）なので number。author_id も integer。
 */
export type KnowledgeSearchResult = {
  id: number
  category: string
  title: string
  snippet: string
  author_id: number
  created_at: string
}

/**
 * GET /knowledge-articles/:id の詳細。tags は値が無いとき null。
 * interface/knowledge/[id]/route.ts の responseBody は id/title/category/tags/body_md に加えて
 * author_id/created_at を含む。author_id は integer（number）、created_at は text（string）。
 */
export type KnowledgeDetailResponse = {
  id: number
  title: string
  category: string
  tags: string | null
  body_md: string
  author_id: number
  created_at: string
}

/**
 * POST /knowledge-articles のリクエストボディ。
 * api/src/interface/knowledge/route.ts の zValidator と同形。tags は省略可・null 可。
 */
export type KnowledgeCreateRequest = {
  title: string
  category: string
  tags?: string | null
  body_md: string
}

/**
 * PUT /knowledge-articles/:id のリクエストボディ。作成時と同じ全項目を送る。
 * api/src/interface/knowledge/[id]/route.ts の zValidator と同形。
 */
export type KnowledgeUpdateRequest = {
  title: string
  category: string
  tags?: string | null
  body_md: string
}

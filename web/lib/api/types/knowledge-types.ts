// api/src/knowledge/* のスキーマと同形の手書き type（API と疎結合に保つ）。

// GET /knowledge のクエリ。未指定は null で表す。
// api/src/knowledge/knowledge-search-request-schema.ts と同形。
export type KnowledgeSearchQuery = {
  q: string | null
  category: string | null
}

// GET /knowledge の一覧要素。
// api/src/knowledge/knowledge-search-result-schema.ts と同形。
export type KnowledgeSearchResult = {
  id: number
  category: string
  title: string
  snippet: string
}

// GET /knowledge/:id の詳細。tags は値が無いとき null。
// api/src/knowledge/knowledge-detail-response-schema.ts と同形。
export type KnowledgeDetailResponse = {
  id: number
  title: string
  category: string
  tags: string | null
  body_md: string
}

// POST /knowledge のリクエストボディ。
// api/src/interface/knowledge/route.ts の zValidator と同形。tags は省略可・null 可。
export type KnowledgeCreateRequest = {
  title: string
  category: string
  tags?: string | null
  body_md: string
}

// PUT /knowledge/:id のリクエストボディ。作成時と同じ全項目を送る。
// api/src/interface/knowledge/[id]/route.ts の zValidator と同形。
export type KnowledgeUpdateRequest = {
  title: string
  category: string
  tags?: string | null
  body_md: string
}

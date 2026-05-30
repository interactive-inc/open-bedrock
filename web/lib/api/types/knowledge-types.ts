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

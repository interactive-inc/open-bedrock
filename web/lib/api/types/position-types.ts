// api/src/position の *-schema.ts と同形の手書き type。
// api と疎結合にするため api 側からは import しない（snake_case で受ける）。

// GET /positions のレスポンス要素。api は snake_case で返す。
export type PositionResponse = {
  id: number
  code: string
  name: string
  rank: number
  description: string | null
  created_at: string
}

// POST /positions のリクエストボディ。description は未指定可。
export type PositionCreateRequest = {
  code: string
  name: string
  rank: number
  description?: string
}

// PUT /positions/:id のリクエストボディ。
export type PositionUpdateRequest = {
  code: string
  name: string
  rank: number
  description?: string
}

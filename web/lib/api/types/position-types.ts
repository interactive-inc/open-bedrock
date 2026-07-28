/** GET /position-definitions のレスポンス要素。api は snake_case で返す。 */
export type PositionResponse = {
  id: number
  code: string
  name: string
  rank: number
  description: string | null
  created_at: string
}

/** POST /position-definitions のリクエストボディ。description は未指定可。 */
export type PositionCreateRequest = {
  code: string
  name: string
  rank: number
  description?: string
}

/** PUT /position-definitions/:id のリクエストボディ。 */
export type PositionUpdateRequest = {
  code: string
  name: string
  rank: number
  description?: string
}

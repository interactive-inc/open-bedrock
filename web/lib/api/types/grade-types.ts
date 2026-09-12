/** GET /grade-definitions のレスポンス要素。api は snake_case で返す。 */
export type GradeResponse = {
  id: number
  code: string
  name: string
  rank: number
  description: string | null
  created_at: string
}

/** POST /grade-definitions のリクエストボディ。description は未指定可。 */
export type GradeCreateRequest = {
  code: string
  name: string
  rank: number
  description?: string
}

/** PUT /grade-definitions/:id のリクエストボディ。 */
export type GradeUpdateRequest = {
  code: string
  name: string
  rank: number
  description?: string
}

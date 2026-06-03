// year-end-adjustment ドメインの手書き型。api 側 zod スキーマと疎結合に保つため
// z.infer を import せず、レスポンス/リクエストの shape をここで独立に定義する。

// POST /year-end-adjustments のリクエストボディ。note は任意（記録のみ）。
export type YearEndAdjustmentCreateRequest = {
  target_year: number
  note: string | null
}

// PUT /year-end-adjustments/:id のリクエストボディ。
export type YearEndAdjustmentUpdateRequest = {
  target_year: number
  note: string | null
}

// GET /year-end-adjustments/me と /year-end-adjustments/:id のレスポンス要素。api は snake_case で返す。
export type YearEndAdjustmentResponse = {
  id: string
  employee_id: number
  target_year: number
  note: string | null
  status: string
  created_at: string
}

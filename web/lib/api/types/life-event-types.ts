// life-event ドメインの手書き型。api 側 zod スキーマと疎結合に保つため
// z.infer を import せず、レスポンス/リクエストの shape をここで独立に定義する。

// POST /life-events のリクエストボディ。detail は任意（記録のみ）。
export type LifeEventCreateRequest = {
  event_type: string
  event_date: string
  detail: string | null
}

// PUT /life-events/:id のリクエストボディ。
export type LifeEventUpdateRequest = {
  event_type: string
  event_date: string
  detail: string | null
}

// GET /life-events/me と /life-events/:id のレスポンス要素。api は snake_case で返す。
export type LifeEventResponse = {
  id: string
  employee_id: number
  event_type: string
  event_date: string
  detail: string | null
  status: string
  created_at: string
}

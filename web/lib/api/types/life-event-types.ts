/** ライフイベント種別。api の lifeEventTypeSchema と同形を手書きする。 */
export type LifeEventType =
  | "marriage"
  | "divorce"
  | "childbirth"
  | "relocation"
  | "dependent_added"
  | "dependent_removed"

/** POST /life-events のリクエストボディ。detail は任意（記録のみ）。 */
export type LifeEventCreateRequest = {
  event_type: LifeEventType
  event_date: string
  detail: string | null
}

/** PUT /life-events/:id のリクエストボディ。 */
export type LifeEventUpdateRequest = {
  event_type: LifeEventType
  event_date: string
  detail: string | null
}

/** GET /life-events/me と /life-events/:id のレスポンス要素。api は snake_case で返す。 */
export type LifeEventResponse = {
  id: string
  employee_id: number
  event_type: LifeEventType
  event_date: string
  detail: string | null
  status: string
  created_at: string
}

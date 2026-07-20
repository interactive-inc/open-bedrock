/** 会社カレンダーの日種別。holiday=会社休日、workday=振替出勤日。 */
export type CalendarDayKind = "holiday" | "workday"

/** GET /calendar のレスポンス要素。api は snake_case で返す。 */
export type CompanyCalendarDayResponse = {
  id: number
  calendar_date: string
  kind: CalendarDayKind
  name: string | null
  created_at: string
}

/** POST /calendar/days のリクエストボディ。name は未指定可。 */
export type CalendarDayCreateRequest = {
  calendar_date: string
  kind: CalendarDayKind
  name: string | null
}

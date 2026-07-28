/** 時間外の集計の参照範囲。reports=配下、all=全社。未指定は本人のみ。 */
export type OvertimeScope = "reports" | "all"

/** 従業員ごとの時間外の参考集計。overtime_minutes は 1 日 8 時間×営業日を超えた分（法定判定ではない）。 */
export type OvertimeSummaryEntry = {
  employee_id: number
  work_days: number
  total_work_minutes: number
  overtime_minutes: number
}

/** GET /attendance-records/overtime-summary のレスポンス。note は「法定判定ではない参考集計」である旨の説明。 */
export type OvertimeSummaryResponse = {
  month: string
  business_days: number
  daily_regular_minutes: number
  entries: ReadonlyArray<OvertimeSummaryEntry>
  note: string
}

/** GET /attendance-records/overtime-summary のクエリ。null のキーは送信されない。 */
export type OvertimeSummaryQuery = {
  month: string | null
  scope: OvertimeScope | null
}

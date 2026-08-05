/** GET /health-checkups の要素。api は snake_case で返す。 */
export type HealthCheckupResponse = {
  id: number
  employee_id: number
  fiscal_year: number
  checkup_kind: string
  conducted_on: string | null
  status: string
  note: string | null
  created_at: string
}

/** 健診・ストレスチェックの種別。 */
export type HealthCheckupKind = "regular" | "stress_check"

/** 実施記録の受診状態。 */
export type HealthCheckupStatus = "scheduled" | "completed" | "declined"

/** POST /health-checkups のリクエストボディ。対象は employee_id / employee_code のどちらか一方で指定する。 */
export type HealthCheckupCreateRequest = {
  employee_id?: number
  employee_code?: string
  fiscal_year: number
  checkup_kind: HealthCheckupKind
  conducted_on?: string
  status?: HealthCheckupStatus
  note?: string
}

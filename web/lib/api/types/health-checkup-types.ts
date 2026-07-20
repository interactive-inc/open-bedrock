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

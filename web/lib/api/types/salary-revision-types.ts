/** GET /salary-revisions のレスポンス要素。api は snake_case で返す。 */
export type SalaryRevisionResponse = {
  id: number
  employee_id: string
  effective_date: string
  previous_base_salary: number
  new_base_salary: number
  reason: string | null
  created_at: string
}

/** POST /salary-revisions のリクエストボディ。対象は employee_id / employee_code のどちらか一方で指定する。 */
export type SalaryRevisionCreateRequest = {
  employee_id?: string
  employee_code?: string
  effective_date: string
  previous_base_salary: number
  new_base_salary: number
  reason?: string
}

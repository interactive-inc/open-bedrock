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

/** GET /employee-grades のレスポンス要素（従業員の等級付与履歴）。 */
export type EmployeeGradeResponse = {
  id: number
  employee_id: number
  grade_id: number
  effective_date: string
  reason: string | null
  created_at: string
  review_cycle_id: number | null
}

/** GET /employee-grades のクエリ。employee_code で対象を指定する。 */
export type EmployeeGradeSearchQuery = {
  employeeCode: string
}

/** POST /employee-grades のリクエストボディ。reason・review_cycle_id は未指定可。 */
export type EmployeeGradeCreateRequest = {
  employee_id: number
  grade_id: number
  effective_date: string
  reason?: string
  review_cycle_id?: number | null
}

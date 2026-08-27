/** POST /resignations のリクエストボディ。last_working_date と reason は任意（記録のみ）。 */
export type ResignationCreateRequest = {
  resignation_date: string
  last_working_date: string | null
  reason: string | null
}

/** PUT /resignations/:id のリクエストボディ。 */
export type ResignationUpdateRequest = {
  resignation_date: string
  last_working_date: string | null
  reason: string | null
}

/** GET /resignations/me と /resignations/:id のレスポンス要素。api は snake_case で返す。 */
export type ResignationResponse = {
  id: string
  employee_id: string
  resignation_date: string
  last_working_date: string | null
  reason: string | null
  status: string
  created_at: string
}

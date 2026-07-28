/** POST /family-care-leaves のリクエストボディ。note は任意（記録のみ）。 */
export type FamilyCareLeaveCreateRequest = {
  leave_kind: string
  start_date: string
  end_date: string
  note: string | null
}

/** PUT /family-care-leaves/:id のリクエストボディ。 */
export type FamilyCareLeaveUpdateRequest = {
  leave_kind: string
  start_date: string
  end_date: string
  note: string | null
}

/** GET /family-care-leaves/me と /family-care-leaves/:id のレスポンス要素。api は snake_case で返す。 */
export type FamilyCareLeaveResponse = {
  id: string
  employee_id: number
  leave_kind: string
  start_date: string
  end_date: string
  note: string | null
  status: string
  created_at: string
}

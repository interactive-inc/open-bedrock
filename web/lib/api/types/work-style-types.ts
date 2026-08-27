/** 勤務形態の区分。制度の適法性判定はしない。 */
export type WorkStyle = "regular" | "flextime" | "discretionary" | "shift"

/** GET /employee-work-styles のレスポンス要素。 */
export type EmployeeWorkStyleResponse = {
  id: number
  employee_id: string
  style: WorkStyle
  starts_on: string
  ends_on: string | null
  note: string | null
  created_at: string
}

/** GET /employee-work-styles のクエリ。employee_code で対象を指定する。 */
export type WorkStyleSearchQuery = {
  employeeCode: string
}

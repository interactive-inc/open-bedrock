/** 異動・在籍イベントの種別。join=入社 / transfer=異動 / leave_of_absence=休職 / return=復職 / retire=退職。 */
export type EmployeeEventKind = "join" | "transfer" | "leave_of_absence" | "return" | "retire"

/** GET /employee-events のレスポンス要素。api は snake_case で返す。 */
export type EmployeeEventResponse = {
  id: number
  employee_id: number
  kind: string
  effective_date: string
  from_department_code: string | null
  to_department_code: string | null
  note: string | null
  created_at: string
}

/** GET /employee-events のクエリ。employee_code で対象を指定し、kind で絞り込める。 */
export type EmployeeEventSearchQuery = {
  employeeCode: string
  kind: EmployeeEventKind | null
}

/** POST /employee-events のリクエストボディ。 */
export type EmployeeEventCreateRequest = {
  employee_id: number
  kind: EmployeeEventKind
  effective_date: string
  from_department_code?: string
  to_department_code?: string
  note?: string
}

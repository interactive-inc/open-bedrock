// api/src/employee/employee-response-schema.ts と同形の手書き type。
export type EmployeeResponse = {
  code: string
  name: string
  dept_name: string | null
  position: string | null
  email: string
  status: string
  role: "member" | "manager" | "hr" | "admin"
}

// 在籍状況。api の status enum と同形。
export type EmployeeStatus = "active" | "leave" | "retired"

// ロール。api の role enum と同形。
export type EmployeeRole = "member" | "manager" | "hr" | "admin"

// POST /employees のリクエストボディ。
export type EmployeeCreateRequest = {
  code: string
  name: string
  email: string
  password: string
  role: "member" | "manager" | "hr" | "admin"
  dept_id?: number | null
  dept_name?: string | null
  position?: string | null
  status: EmployeeStatus
}

// PUT /employees/:code のリクエストボディ。
export type EmployeeUpdateRequest = {
  name: string
  email: string
  role: "member" | "manager" | "hr" | "admin"
  dept_id?: number | null
  dept_name?: string | null
  position?: string | null
  status: EmployeeStatus
}

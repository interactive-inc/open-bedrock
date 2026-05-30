// api/src/employee/employee-response-schema.ts と同形の手書き type。
export type EmployeeResponse = {
  code: string
  name: string
  dept_name: string | null
  position: string | null
  email: string
  status: string
  role: string
}

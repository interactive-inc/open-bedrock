// api/src/employee/employee-response-schema.ts と同形の手書き type。
// 共有 types/employee-types.ts とは別に employees ドメイン専用で持ち、API と疎結合にする。
export type EmployeeListItem = {
  code: string
  name: string
  deptName: string | null
  position: string | null
  email: string
  status: string
}

// GET /employees/:code の詳細。一覧と違い role を含む。
export type EmployeeDetailItem = {
  code: string
  name: string
  deptName: string | null
  position: string | null
  email: string
  status: string
  role: string
}

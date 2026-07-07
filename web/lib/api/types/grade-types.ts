// api/src/grade の *-schema.ts と同形の手書き type。
// api と疎結合にするため api 側からは import しない（snake_case で受ける）。

// GET /grades のレスポンス要素。api は snake_case で返す。
export type GradeResponse = {
  id: number
  code: string
  name: string
  rank: number
  description: string | null
  created_at: string
}

// POST /grades のリクエストボディ。description は未指定可。
export type GradeCreateRequest = {
  code: string
  name: string
  rank: number
  description?: string
}

// PUT /grades/:id のリクエストボディ。
export type GradeUpdateRequest = {
  code: string
  name: string
  rank: number
  description?: string
}

// GET /grades/assignments のレスポンス要素（従業員の等級付与履歴）。
export type EmployeeGradeResponse = {
  id: number
  employee_id: number
  grade_id: number
  effective_date: string
  reason: string | null
  created_at: string
  review_cycle_id: number | null
}

// GET /grades/assignments のクエリ。employee_code で対象を指定する。
export type EmployeeGradeSearchQuery = {
  employeeCode: string
}

// POST /grades/assignments のリクエストボディ。reason・review_cycle_id は未指定可。
export type EmployeeGradeCreateRequest = {
  employee_id: number
  grade_id: number
  effective_date: string
  reason?: string
  review_cycle_id?: number | null
}

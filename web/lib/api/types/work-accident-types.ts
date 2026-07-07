// work-accident ドメインの手書き型。

// GET /work-accidents の要素。api は snake_case で返す。
export type WorkAccidentResponse = {
  id: number
  occurred_on: string
  employee_id: number | null
  location: string | null
  summary: string
  severity: string | null
  status: string
  created_at: string
}

// POST /work-accidents のリクエストボディ。
export type WorkAccidentCreateRequest = {
  occurred_on: string
  employee_id: number | null
  location: string | null
  summary: string
  severity: "minor" | "serious" | null
}

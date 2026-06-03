// api/src/payroll の route ハンドラのレスポンス/リクエストと同形の手書き type。
// api と疎結合に保つため z.infer を import せずここで独立に定義する。

// status は API 上 DB の text 列をそのまま返すため string。
export type PayslipStatus = string

// GET /payslips/me の各要素（自分の給与明細一覧）。
// API ハンドラは status を string で返すため、union ではなく string で受ける。
export type PayslipMineResponse = {
  id: number
  employee_id: number
  period: string
  base_salary: number
  allowances: number
  deductions: number
  net_pay: number
  issued_at: string | null
  status: string
}

// GET /payslips/:id のレスポンス（給与明細詳細）。一覧と同形。
export type PayslipDetailResponse = {
  id: number
  employee_id: number
  period: string
  base_salary: number
  allowances: number
  deductions: number
  net_pay: number
  issued_at: string | null
  status: string
}

// POST /payslips のリクエスト body（特権ロールが対象社員の明細を発行）。
export type PayslipIssueRequest = {
  employee_code: string
  period: string
  base_salary: number
  allowances: number
  deductions: number
}

// GET /salary-revisions/:employee_code の各要素（給与改定履歴）。
export type SalaryRevisionResponse = {
  id: number
  employee_id: number
  effective_date: string
  previous_base_salary: number
  new_base_salary: number
  reason: string | null
  created_at: string
}

// POST /salary-revisions のリクエスト body（特権ロールが給与改定を作成）。
// API ハンドラは reason を任意項目として受けるため optional で定義する。
export type SalaryRevisionCreateRequest = {
  employee_code: string
  effective_date: string
  new_base_salary: number
  // api 側は .optional()（string | undefined）のため null ではなく省略可能にする。
  reason?: string
}

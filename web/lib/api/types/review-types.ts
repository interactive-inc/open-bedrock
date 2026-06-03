// api/src/interface/review の route ハンドラのレスポンス/リクエストと同形の手書き type。
// api と疎結合に保つため z.infer を import せずここで独立に定義する。

export type ReviewCycleStatus = "draft" | "open" | "closed"

export type ReviewerType = "self" | "manager" | "peer" | "subordinate"

export type ReviewFormStatus = "pending" | "submitted"

// GET /review-cycles の各要素。POST /review-cycles, open/close のレスポンスも同形。
export type ReviewCycleResponse = {
  id: number
  title: string
  period: string
  status: ReviewCycleStatus
  due_date: string | null
}

// POST /review-cycles のリクエスト body（管理者が draft のサイクルを作成）。
export type ReviewCycleCreateRequest = {
  title: string
  period: string
  dueDate: string | null
}

// GET /review-forms/me の各要素。POST /review-forms/:form_id/submit のレスポンスも同形。
export type ReviewFormResponse = {
  id: number
  cycle_id: number
  subject_employee_id: number
  reviewer_employee_id: number
  reviewer_type: string
  answers: ReadonlyArray<unknown>
  score: number | null
  status: string
  submitted_at: string | null
}

// POST /review-forms/:form_id/submit のリクエスト body。
export type ReviewFormSubmitRequest = {
  score: number | null
  answers: ReadonlyArray<unknown>
  comment: string | null
}

// GET /review-cycles/:cycle_id/results/:employee_code のレスポンス（集計済みの評価結果）。
export type ReviewResultResponse = {
  cycle_id: number
  subject_employee_id: number
  form_count: number
  submitted_count: number
  average_score: number | null
  forms: ReadonlyArray<ReviewFormResponse>
}

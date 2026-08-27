/** status / reviewer_type は API 上 DB の text 列をそのまま返すため string。 */
export type ReviewCycleStatus = string

export type ReviewerType = string

export type ReviewFormStatus = string

/** GET /review-cycles の各要素。POST /review-cycles, open/close のレスポンスも同形。 */
export type ReviewCycleResponse = {
  id: number
  title: string
  period: string
  status: ReviewCycleStatus
  due_date: string | null
}

/** POST /review-cycles のリクエスト body（管理者が draft のサイクルを作成）。 */
export type ReviewCycleCreateRequest = {
  title: string
  period: string
  dueDate: string | null
  policy: ReviewCyclePolicy
}

export type ReviewCyclePolicy = {
  include_self: boolean
  include_manager: boolean
  include_peers: boolean
  include_subordinates: boolean
  peer_count: number
}

/** PUT /review-cycles/:cycle_id のリクエスト body（管理者がサイクルの題目・期間・締切を更新）。 */
export type ReviewCycleUpdateRequest = {
  title: string
  period: string
  dueDate: string | null
}

/** GET /review-forms/me の各要素。POST /review-forms/:form_id/submit のレスポンスも同形。 */
export type ReviewFormResponse = {
  id: number
  cycle_id: number
  subject_employee_id: string
  reviewer_employee_id: string | null
  reviewer_type: string
  answers: ReadonlyArray<unknown>
  score: number | null
  status: string
  submitted_at: string | null
}

/** POST /review-cycles/:cycle_id/forms/bulk のリクエスト各要素（被評価者と評価者種別の組）。 */
export type ReviewFormBulkItem = {
  subject_employee_id: string
  reviewer_employee_id: string
  reviewer_type: "self" | "manager" | "peer" | "subordinate"
}

/** POST /review-forms/:form_id/submit のリクエスト body。 */
export type ReviewFormSubmitRequest = {
  score: number | null
  // api 側の json バリデータは可変配列を要求するため readonly にしない。
  answers: Array<unknown>
  comment: string | null
}

/** GET /review-cycles/:cycle_id/results/:employee_code のレスポンス（集計済みの評価結果）。 */
export type ReviewResultResponse = {
  cycle_id: number
  subject_employee_id: string
  form_count: number
  submitted_count: number
  average_score: number | null
  reviewer_type_summary: ReadonlyArray<{
    reviewer_type: string
    form_count: number
    submitted_count: number
  }>
  forms: ReadonlyArray<ReviewFormResponse>
}

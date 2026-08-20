export type ExpenseCategory = "transport" | "supplies" | "entertainment" | "books" | "other"

export type ExpenseStatus = "pending" | "approved" | "rejected" | "settled"

/** GET /expenses/me の各要素（自分の経費一覧）。 */
export type ExpenseMineResponse = {
  id: number
  category: ExpenseCategory
  amount: number
  spent_at: string
  status: ExpenseStatus
  created_at: string
}

/** GET /expenses/inbox の各要素（承認待ち一覧）。 */
export type ExpenseInboxResponse = {
  id: number
  applicant_name: string
  category: ExpenseCategory
  amount: number
  spent_at: string
  status: ExpenseStatus
  created_at: string
}

/**
 * GET /expenses/:id のレスポンス（経費詳細）。api は snake_case で返す。
 * employee_id も含まれる（[id]/route.ts の body 構築）。
 */
export type ExpenseAttachmentSummary = {
  id: string
  file_name: string
  content_type: string
  byte_size: number
}

export type ExpenseDetailResponse = {
  id: number
  employee_id: number
  applicant_name: string
  category: ExpenseCategory
  amount: number
  spent_at: string
  note: string | null
  status: ExpenseStatus
  created_at: string
  attachments: ReadonlyArray<ExpenseAttachmentSummary>
}

/**
 * POST /expenses のレスポンス（作成された経費。api は snake_case で返す）。
 * id は Expense ドメインで number | null（永続化前は null）。
 */
export type ExpenseCreatedResponse = {
  id: number | null
  employee_id: number
  category: ExpenseCategory
  amount: number
  spent_at: string
  note: string | null
  status: ExpenseStatus
  created_at: string
}

/** POST /expenses/:id/approve|reject のレスポンス。 */
export type ExpenseDecisionResponse = {
  status: ExpenseStatus
}

/** POST /expenses のリクエスト body。 */
export type ExpenseSubmitRequest = {
  category: ExpenseCategory
  amount: number
  spent_at: string
  note?: string
  attachment_ids?: string[]
}

/** PUT /expenses/:id のリクエスト body。 */
export type ExpenseUpdateRequest = {
  category: ExpenseCategory
  amount: number
  spent_at: string
  note: string | null
}

/**
 * PUT /expenses/:id のレスポンス（更新後の経費。api は snake_case で返す）。
 * id は api の整形結果として number | null になりうる。
 */
export type ExpenseUpdatedResponse = {
  id: number | null
  employee_id: number
  category: ExpenseCategory
  amount: number
  spent_at: string
  note: string | null
  status: ExpenseStatus
  created_at: string
}

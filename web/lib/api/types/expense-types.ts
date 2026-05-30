// api/src/expense/*-schema.ts と同形の手書き type（api と疎結合に保つため別定義）。

export type ExpenseCategory = "transport" | "supplies" | "entertainment" | "books" | "other"

export type ExpenseStatus = "pending" | "approved" | "rejected" | "settled"

// GET /expenses/me の各要素（自分の経費一覧）。
export type ExpenseMineResponse = {
  id: number
  category: ExpenseCategory
  amount: number
  spent_at: string
  status: ExpenseStatus
  created_at: string
}

// GET /expenses/inbox の各要素（承認待ち一覧）。
export type ExpenseInboxResponse = {
  id: number
  applicant_name: string
  category: ExpenseCategory
  amount: number
  spent_at: string
  status: ExpenseStatus
  created_at: string
}

// GET /expenses/:id のレスポンス（経費詳細）。
export type ExpenseDetailResponse = {
  id: number
  applicant_name: string
  category: ExpenseCategory
  amount: number
  spent_at: string
  note: string | null
  status: ExpenseStatus
  created_at: string
}

// POST /expenses のレスポンス（作成された経費。内部表現の camelCase）。
export type ExpenseCreatedResponse = {
  id: number
  employeeId: number
  category: ExpenseCategory
  amount: number
  spentAt: string
  note: string | null
  status: ExpenseStatus
  createdAt: string
}

// POST /expenses/:id/approve|reject のレスポンス。
export type ExpenseDecisionResponse = {
  status: ExpenseStatus
}

// POST /expenses のリクエスト body。
export type ExpenseSubmitRequest = {
  category: ExpenseCategory
  amount: number
  spent_at: string
  note?: string
}

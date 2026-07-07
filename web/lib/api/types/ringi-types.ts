// api/src/ringi/*-schema.ts と同形の手書き type（api と疎結合に保つため別定義）。

export type RingiStatus = "pending" | "approved" | "rejected"

// GET /ringi/me の各要素（自分の起案一覧）。
export type RingiMineResponse = {
  id: number
  approver_id: number
  approver_name: string
  title: string
  amount: number
  status: RingiStatus
  decided_at: string | null
  created_at: string
}

// GET /ringi/inbox の各要素（承認待ち一覧）。
export type RingiInboxResponse = {
  id: number
  applicant_id: number
  applicant_name: string
  title: string
  amount: number
  reason: string
  status: RingiStatus
  created_at: string
}

// GET /ringi/admin の各要素（全社横断の稟議一覧）。
export type RingiAdminResponse = {
  id: number
  applicant_id: number
  applicant_name: string
  applicant_dept_name: string | null
  approver_id: number
  approver_name: string
  title: string
  amount: number
  status: RingiStatus
  decided_at: string | null
  created_at: string
}

// POST /ringi/:id/approve|reject のレスポンス。
export type RingiDecisionResponse = {
  status: RingiStatus
}

// POST /ringi のリクエスト body。
export type RingiSubmitRequest = {
  approver_id: number
  title: string
  amount: number
  reason: string
}

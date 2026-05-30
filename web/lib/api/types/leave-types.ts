// leave ドメインの手書き型。api 側 zod スキーマと疎結合に保つため z.infer を import せず
// レスポンス/リクエストの shape をここで独立に定義する。

export type LeaveType = "annual" | "special"

export type LeaveStatus = "pending" | "approved" | "rejected"

// GET /leave/balance/me のレスポンス要素 (toLeaveBalanceResponse の出力)。
export type LeaveBalanceResponse = {
  fiscal_year: string
  leave_type: LeaveType
  granted_days: number
  used_days: number
  remaining_days: number
}

// GET /leave/requests/me のレスポンス要素 (toLeaveRequestMineResponse の出力)。
export type LeaveRequestMineResponse = {
  id: number
  leave_type: LeaveType
  start_date: string
  end_date: string
  days: number
  status: LeaveStatus
  created_at: string
}

// GET /leave/requests/inbox のレスポンス要素 (承認者向け、申請者名付き)。
export type LeaveRequestInboxResponse = {
  id: number
  applicant_name: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  days: number
  reason: string | null
  status: LeaveStatus
  created_at: string
}

// POST /leave/requests のリクエストボディ。
export type LeaveRequestCreateRequest = {
  leave_type: LeaveType
  start_date: string
  end_date: string
  reason: string | null
}

// POST /leave/requests のレスポンス (作成された leave request エンティティ)。
export type LeaveRequestCreated = {
  id: number
  employeeId: number
  leaveType: LeaveType
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: LeaveStatus
  approverId: number | null
  decidedComment: string | null
  createdAt: string
}

// POST /leave/requests/:id/approve | reject のレスポンス。
export type LeaveDecisionResponse = {
  status: LeaveStatus
}

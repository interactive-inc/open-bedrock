// api/src/interface/shift の route ハンドラのレスポンス/リクエストと同形の手書き type。
// api と疎結合に保つため z.infer を import せずここで独立に定義する。

export type ShiftSwapStatus = "pending" | "approved"

// GET /shift/assignments/me, GET /shift/assignments の各要素（シフト割当）。
// POST /shift/assignments, POST /shift/assignments/:id/publish のレスポンスも同形。
export type ShiftAssignmentResponse = {
  id: number
  employee_id: number
  pattern_id: number
  date: string
  note: string | null
  published_at: string | null
}

// GET /shift/patterns の各要素（シフトパターン）。POST /shift/patterns のレスポンスも同形。
export type ShiftPatternResponse = {
  id: number
  code: string
  name: string
  start_time: string
  end_time: string
  break_minutes: number | null
}

// POST /shift/swap-requests, POST /shift/swap-requests/:id/approve のレスポンス（交代申請）。
export type ShiftSwapRequestResponse = {
  id: number
  requester_employee_id: number
  target_employee_id: number
  date: string
  note: string | null
  status: ShiftSwapStatus
  approved_at: string | null
}

// POST /shift/assignments のリクエスト body（特権ロールが社員にシフトを割り当てる）。
export type ShiftAssignmentCreateRequest = {
  employee_code: string
  pattern_code: string
  date: string
  note: string | null
}

// POST /shift/patterns のリクエスト body（特権ロールがシフトパターンを作成する）。
export type ShiftPatternCreateRequest = {
  code: string
  name: string
  start_time: string
  end_time: string
  break_minutes: number | null
}

// POST /shift/swap-requests のリクエスト body（本人が交代を申請する）。
export type ShiftSwapRequestCreateRequest = {
  target_employee_code: string
  date: string
  note: string | null
}

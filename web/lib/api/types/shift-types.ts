// api/src/interface/shift の route ハンドラのレスポンス/リクエストと同形の手書き type。
// api と疎結合に保つため z.infer を import せずここで独立に定義する。

// status は API 上 DB の text 列をそのまま返すため string。
export type ShiftSwapStatus = string

// GET /shift/assignments/me, GET /shift/assignments の各要素（シフト割当）。
// POST /shift/assignments, POST /shift/assignments/:id/publish のレスポンスも同形。
// id は作成系が insert 直後の autoincrement、pattern_id は nullable 列のため number | null。
export type ShiftAssignmentResponse = {
  id: number | null
  employee_id: number
  pattern_id: number | null
  date: string
  note: string | null
  published_at: string | null
}

// GET /shift/patterns の各要素（シフトパターン）。POST /shift/patterns のレスポンスも同形。
export type ShiftPatternResponse = {
  id: number | null
  code: string
  name: string
  start_time: string
  end_time: string
  break_minutes: number | null
}

// POST /shift/swap-requests, POST /shift/swap-requests/:id/approve のレスポンス（交代申請）。
export type ShiftSwapRequestResponse = {
  id: number | null
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
  // api 側は .optional()（string | undefined）のため null ではなく省略可能にする。
  note?: string
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

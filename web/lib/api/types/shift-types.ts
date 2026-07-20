/** status は API 上 DB の text 列をそのまま返すため string。 */
export type ShiftSwapStatus = string

/**
 * GET /shift/assignments の各要素（シフト割当）。
 * POST /shift/assignments, POST /shift/assignments/:id/publish のレスポンスも同形。
 * id は作成・更新・公開レスポンスで採番前の null を含むため nullable。
 * pattern_id は nullable 列のため number | null。
 */
export type ShiftAssignmentResponse = {
  id: number | null
  employee_id: number
  pattern_id: number | null
  date: string
  note: string | null
  published_at: string | null
}

/**
 * GET /shift/assignments/me の各要素（本人向けシフト割当）。
 * member はパターン一覧（/shift/patterns）を閲覧できないため、割当にパターン名・時間帯を埋めて返す。
 * pattern_* は割当にパターンが紐付かない場合 null。
 */
export type MyShiftAssignmentResponse = {
  id: number
  employee_id: number
  pattern_id: number | null
  pattern_name: string | null
  pattern_start_time: string | null
  pattern_end_time: string | null
  date: string
  note: string | null
  published_at: string | null
}

/**
 * GET /shift/patterns の各要素（シフトパターン）。POST /shift/patterns のレスポンスも同形。
 * id は作成・更新レスポンスで採番前の null を含むため nullable。
 */
export type ShiftPatternResponse = {
  id: number | null
  code: string
  name: string
  start_time: string
  end_time: string
  break_minutes: number
}

/**
 * POST /shift/swap-requests, POST /shift/swap-requests/:id/approve,
 * GET/PUT /shift/swap-requests/:id のレスポンス（交代申請）。
 * 申請者・対象は社員 ID（number）で返る。
 * status は api が任意文字列で返すため string。id は採番前 null を含む。
 */
export type ShiftSwapRequestResponse = {
  id: number | null
  requester_employee_id: number
  target_employee_id: number
  date: string
  note: string | null
  status: string
  approved_at: string | null
}

/**
 * GET /shift/swap-requests/me の各要素（本人向け交代申請）。
 * member は社員 ID から氏名を引けないため、交代相手の氏名を埋めて返す。
 * target_employee_name は該当社員が見つからない場合 null。
 */
export type MyShiftSwapRequestResponse = {
  id: number
  requester_employee_id: number
  target_employee_id: number
  target_employee_name: string | null
  date: string
  note: string | null
  status: string
  approved_at: string | null
}

/**
 * GET /shift/swap-requests（承認者向け inbox）の各要素。
 * inbox は employees を JOIN して社員 ID ではなく社員コード（string）を返すため /me と別形。
 * 該当者が見つからない場合 api 側は空文字を返す（route.ts の `?? ""`）。
 */
export type ShiftSwapRequestInboxResponse = {
  id: number
  requester_employee_code: string
  target_employee_code: string
  date: string
  note: string | null
  status: string
  approved_at: string | null
}

/**
 * POST /shift/assignments のリクエスト body（特権ロールが社員にシフトを割り当てる）。
 * note 無しは null（api 側は note?: string なので送信時に undefined へ変換する）。
 */
export type ShiftAssignmentCreateRequest = {
  employee_code: string
  pattern_code: string
  date: string
  // api 側は .optional()（string | undefined）のため null ではなく省略可能にする。
  note?: string
}

/** POST /shift/patterns のリクエスト body（特権ロールがシフトパターンを作成する）。 */
export type ShiftPatternCreateRequest = {
  code: string
  name: string
  start_time: string
  end_time: string
  break_minutes: number | null
}

/** POST /shift/swap-requests のリクエスト body（本人が交代を申請する）。 */
export type ShiftSwapRequestCreateRequest = {
  target_employee_code: string
  date: string
  note: string | null
}

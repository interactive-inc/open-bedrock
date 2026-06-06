// api/src/interface/thanks/route.ts のレスポンス/リクエストと同形の手書き type。
// api と疎結合に保つため z.infer を import せずここで独立に定義する。

// GET /thanks の各要素・POST /thanks のレスポンス（感謝のタイムライン要素）。
export type ThanksResponse = {
  // 作成系は insert 直後の autoincrement id（number | null）を返す。
  id: number | null
  sender_employee_id: number
  sender_name: string
  recipient_employee_id: number
  recipient_name: string
  message: string
  // 本 Task では常に 0。将来のポイント付与用。
  points: number
  created_at: string
}

// POST /thanks のリクエスト body。送り手は token から解決されるため指定しない。
export type ThanksCreateRequest = {
  recipient_employee_code: string
  message: string
}

/** GET /thanks-messages の各要素・POST /thanks-messages のレスポンス（感謝のタイムライン要素）。 */
export type ThanksResponse = {
  // 作成系は insert 直後の autoincrement id（number | null）を返す。
  id: number | null
  sender_employee_id: string
  sender_name: string
  recipient_employee_id: string
  recipient_name: string
  message: string
  // 感謝に添えたサンクスポイント。0 はメッセージのみの感謝。
  points: number
  created_at: string
}

/**
 * POST /thanks-messages のリクエスト body。送り手は token から解決されるため指定しない。
 * points は任意。未指定はメッセージのみの感謝。
 */
export type ThanksCreateRequest = {
  recipient_employee_code: string
  message: string
  points?: number | null
}

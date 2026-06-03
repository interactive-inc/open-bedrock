// api/src/notification の route ハンドラのレスポンス/リクエストと同形の手書き type。
// api と疎結合に保つため z.infer を import せずここで独立に定義する。

export type NotificationKind =
  | "task"
  | "approval_request"
  | "approval_result"
  | "reminder"
  | "announcement"

// GET /notifications/me の各要素（自分宛ての通知一覧）。POST /notifications,
// POST /notifications/:id/read のレスポンスも同形。
export type NotificationResponse = {
  id: number | null
  recipient_employee_id: number
  source_domain: string
  source_id: number | null
  kind: NotificationKind
  title: string
  body: string | null
  is_read: boolean
  created_at: string
}

// GET /notifications/me/unread-count のレスポンス（未読件数）。
export type UnreadCountResponse = {
  count: number
}

// POST /notifications/read-all のレスポンス（既読化した件数）。
export type MarkAllReadResponse = {
  updated: number
}

// POST /notifications のリクエスト body（特権ロールが対象社員へ通知を作成）。
// api の zod スキーマに合わせ、body/kind/source_* は任意。未指定時は api 側で既定値を補う。
export type NotificationCreateRequest = {
  recipient_employee_code: string
  title: string
  kind?: NotificationKind
  body?: string
  source_domain?: string
  source_id?: number
}

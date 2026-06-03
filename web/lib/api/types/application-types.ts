// api/src/application/*-schema.ts と同形の手書き type（api と疎結合に保つため別定義）。

export type ApplicationStatus = "pending" | "approved" | "rejected"

// GET /templates の各要素。
export type ApplicationTemplateResponse = {
  code: string
  name: string
  category: string
  description: string | null
}

// GET /templates/:code。詳細は schemaJson と approverRoles を含む内部表現を返す。
export type ApplicationTemplateDetail = {
  id: number
  code: string
  name: string
  category: string
  description: string | null
  schemaJson: unknown
  approverRoles: ReadonlyArray<string>
}

// GET /applications の各要素（自分の申請一覧）。
export type ApplicationMineResponse = {
  id: number
  template_name: string
  status: ApplicationStatus
  current_step: string | null
  created_at: string
}

// 自分の申請一覧コンポーネントが扱う表示用の項目。編集フォームで payload を JSON 編集する。
// id は永続化前に null になりうる実 API レスポンスに合わせる。
export type ApplicationListItem = {
  id: number | null
  template_id: number
  status: ApplicationStatus
  current_step: string | null
  created_at: string
  payload: unknown
}

// GET /applications/inbox の各要素（承認待ち一覧）。
export type ApplicationInboxResponse = {
  id: number
  template_name: string
  applicant_name: string
  current_step: string | null
  status: ApplicationStatus
  created_at: string
}

// GET /applications/:id および POST /applications のレスポンス。
export type ApplicationDetailResponse = {
  id: number
  template_code: string
  template_name: string
  applicant_name: string
  status: ApplicationStatus
  current_step: string | null
  payload: unknown
  created_at: string
}

// POST /applications/:id/approve|reject のレスポンス。
export type ApplicationDecisionResponse = {
  status: ApplicationStatus
}

// POST /applications のリクエスト body。
export type ApplicationSubmitRequest = {
  template_code: string
  payload: unknown
}

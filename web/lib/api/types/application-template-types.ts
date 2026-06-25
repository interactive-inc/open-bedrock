// api/src/interface/application/templates の route ハンドラのリクエスト/レスポンスと同形の手書き type。
// api と疎結合に保つため z.infer を import せずここで独立に定義する。

// POST /templates のレスポンス、PUT /templates/:code のレスポンスも同形（申請テンプレート）。
// id は作成/更新ルートでは insert 直後の autoincrement id（number | null）を返す。
export type ApplicationTemplateResponse = {
  id: number | null
  code: string
  name: string
  category: string
  description: string | null
  schema_json?: unknown
  approver_roles: ReadonlyArray<string>
}

// POST /templates のリクエスト body（管理権限が申請テンプレートを作成する）。
export type ApplicationTemplateCreateRequest = {
  code: string
  name: string
  category: string
  description: string | null
  schema_json: unknown
  approver_roles: ReadonlyArray<string>
}

// PUT /templates/:code のリクエスト body（管理権限が申請テンプレートの内容を変更する）。code は変更されない。
export type ApplicationTemplateUpdateRequest = {
  name: string
  category: string
  description: string | null
  schema_json: unknown
  approver_roles: ReadonlyArray<string>
}

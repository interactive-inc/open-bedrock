// api/src/oneonone の *-schema.ts と同形の手書き type。
// api と疎結合にするため api 側からは import しない。

// api/src/oneonone/one-on-one-response-schema.ts と同形。
// GET /oneonone と POST /oneonone のレスポンス。フィールドは snake_case のまま受ける。
export type OneOnOne = {
  id: string
  held_at: string
  member_name: string
  manager_name: string
  topics: string | null
  manager_note: string | null
  next_action: string | null
}

// POST /oneonone のリクエストボディ。
// api/src/oneonone/one-on-one-create-request-schema.ts と同形。
// member_email 必須、それ以外は任意（未入力は送らない）。
export type OneOnOneCreateRequest = {
  member_email: string
  topics: string | null
  manager_note: string | null
  next_action: string | null
}

// PUT /oneonone/:id のリクエストボディ。
// api/src/interface/oneonone/[id]/route.ts の PUT zValidator と同形。
// topics / manager_note / next_action を変更する。未入力は null。
export type OneOnOneUpdateRequest = {
  topics: string | null
  manager_note: string | null
  next_action: string | null
}

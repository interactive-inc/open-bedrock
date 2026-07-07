// api の app-schemas（zAppRegulation ほか）と同形の手書き type（api と疎結合に保つため別定義）。

export type RegulationStatus = "active" | "archived"

// GET /regulations の各要素。
export type RegulationListItem = {
  id: number
  code: string
  title: string
  category: string | null
  status: string
  latest_version: number | null
  effective_on: string | null
  created_at: string
}

// 規程の改定版。
export type RegulationVersion = {
  id: number
  version: number
  body_md: string
  effective_on: string
  note: string | null
  created_at: string
}

// GET /regulations/:code の詳細（最新版＋版一覧）。
export type RegulationDetail = {
  id: number
  code: string
  title: string
  category: string | null
  status: string
  created_at: string
  latest_version: RegulationVersion | null
  versions: ReadonlyArray<RegulationVersion>
}

// POST /regulations のリクエスト body。
export type RegulationRegisterRequest = {
  code: string
  title: string
  body_md: string
  effective_on: string
  category?: string
  note?: string
}

// POST /regulations/:code/versions のリクエスト body。
export type RegulationVersionRequest = {
  body_md: string
  effective_on: string
  note?: string
}

// api の app-schemas（zAppContract ほか）と同形の手書き type（api と疎結合に保つため別定義）。

// GET /contracts の並び順。renewal_near=更新期限が近い順。
export type ContractOrder = "renewal_near" | "contract_date_desc" | "contract_date_asc"

// GET /contracts・POST /contracts の各要素（契約記録。API は snake_case で返す）。
export type ContractResponse = {
  id: number
  partner_id: number
  title: string
  contract_date: string
  starts_on: string | null
  ends_on: string | null
  renewal_deadline: string | null
  note: string | null
  created_at: string
}

// GET /contracts のクエリ。partner_id で絞り込み、order で並べ替える。値なしは null。
export type ContractSearchQuery = {
  partnerId: number | null
  order: ContractOrder | null
}

// POST /contracts のリクエスト body。starts_on / ends_on / renewal_deadline / note は任意。
export type ContractCreateRequest = {
  partner_id: number
  title: string
  contract_date: string
  starts_on?: string
  ends_on?: string
  renewal_deadline?: string
  note?: string
}

// PUT /contracts/:id のリクエスト body。starts_on / ends_on / renewal_deadline / note は任意。
export type ContractUpdateRequest = {
  title: string
  contract_date: string
  starts_on?: string
  ends_on?: string
  renewal_deadline?: string
  note?: string
}

/** 取引先の分類。POST /partners の category enum と一致させる。 */
export type PartnerCategory = "customer" | "supplier" | "other"

/** 取引先の状態。active=取引中, archived=終了。 */
export type PartnerStatus = "active" | "archived"

/** GET /partners・GET /partners/:code の各要素（取引先。API は snake_case で返す）。 */
export type PartnerResponse = {
  id: number
  code: string
  name: string
  category: string | null
  corporate_number: string | null
  note: string | null
  status: string
  created_at: string
}

/** GET /partners のクエリ。キーワード / status で絞り込む。値なしは null。 */
export type PartnerSearchQuery = {
  q: string | null
  status: PartnerStatus | null
}

/** POST /partners のリクエスト body。category / corporate_number / note は任意。 */
export type PartnerCreateRequest = {
  code: string
  name: string
  category?: PartnerCategory
  corporate_number?: string
  note?: string
}

/** PUT /partners/:id のリクエスト body。category / corporate_number / note は任意。 */
export type PartnerUpdateRequest = {
  name: string
  category?: PartnerCategory
  corporate_number?: string
  note?: string
}

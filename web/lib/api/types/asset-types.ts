/** 物品の種別。POST /assets の kind enum と一致させる。 */
export type AssetKind = "pc" | "monitor" | "furniture" | "other"

/** 物品の在庫状態。in_stock=在庫, lent=貸与中。 */
export type AssetStatus = "in_stock" | "lent"

/** GET /assets・GET /assets/:code・GET /assets/lent/me の各要素（物品。API は snake_case で返す）。 */
export type AssetResponse = {
  code: string
  name: string
  kind: string
  serial: string | null
  purchased_on: string | null
  status: string
  holder_employee_id: number | null
}

/** GET /assets のクエリ。kind / status で絞り込む。値なしは null。 */
export type AssetSearchQuery = {
  kind: AssetKind | null
  status: AssetStatus | null
}

/** POST /assets のリクエスト body。serial / purchased_on は任意。 */
export type AssetCreateRequest = {
  code: string
  name: string
  kind: AssetKind
  serial?: string
  purchased_on?: string
}

/** POST /assets/:code/lend のリクエスト body。 */
export type AssetLendRequest = {
  employee_code: string
}

/** PUT /assets/:code のリクエスト body。serial / purchased_on は任意。 */
export type AssetUpdateRequest = {
  name: string
  kind: AssetKind
  serial?: string
  purchased_on?: string
}

// api/src/asset/*-schema.ts と同形の手書き type（api と疎結合に保つため別定義）。

// 物品の種別。POST /assets の kind enum と一致させる。
export type AssetKind = "pc" | "monitor" | "furniture" | "other"

// 物品の在庫状態。in_stock=在庫, lent=貸与中。
export type AssetStatus = "in_stock" | "lent"

// GET /assets・GET /assets/:code・GET /assets/lent/me の各要素（物品。内部表現の camelCase）。
export type AssetResponse = {
  code: string
  name: string
  kind: string
  serial: string | null
  purchasedOn: string | null
  status: string
  holderEmployeeId: number | null
}

// GET /assets のクエリ。kind / status で絞り込む。値なしは null。
export type AssetSearchQuery = {
  kind: AssetKind | null
  status: AssetStatus | null
}

// POST /assets のリクエスト body。serial / purchased_on は任意。
export type AssetCreateRequest = {
  code: string
  name: string
  kind: AssetKind
  serial?: string
  purchased_on?: string
}

// POST /assets/:code/lend のリクエスト body。
export type AssetLendRequest = {
  employee_code: string
}

// PUT /assets/:code のリクエスト body。serial / purchased_on は任意。
export type AssetUpdateRequest = {
  name: string
  kind: AssetKind
  serial?: string
  purchased_on?: string
}

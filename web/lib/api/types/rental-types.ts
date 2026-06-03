// rentals ドメインの手書き型。api 側 zod スキーマ (api/src/rental) と疎結合に保つため
// z.infer を import せず、レスポンス/リクエストの shape をここで独立に定義する。

// POST /rentals のリクエストボディ。
export type RentalReservationCreateRequest = {
  item_name: string
  start_date: string
  end_date: string
  purpose: string | null
}

// GET /rentals/me と /rentals/:id のレスポンス要素。api は snake_case で返す。
export type RentalReservationResponse = {
  id: string
  requester_id: number
  item_name: string
  start_date: string
  end_date: string
  purpose: string | null
  status: string
  created_at: string
}

// PUT /rentals/:id のリクエストボディ。
export type RentalReservationUpdateRequest = {
  item_name: string
  start_date: string
  end_date: string
  purpose: string | null
}

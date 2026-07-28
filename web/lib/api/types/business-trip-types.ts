/** POST /business-trips のリクエストボディ。estimated_cost は任意（記録のみ）。 */
export type BusinessTripCreateRequest = {
  destination: string
  start_date: string
  end_date: string
  purpose: string
  estimated_cost: number | null
}

/** PUT /business-trips/:id のリクエストボディ。 */
export type BusinessTripUpdateRequest = {
  destination: string
  start_date: string
  end_date: string
  purpose: string
  estimated_cost: number | null
}

/** GET /business-trips/me と /business-trips/:id のレスポンス要素。api は snake_case で返す。 */
export type BusinessTripResponse = {
  id: string
  traveler_id: number
  destination: string
  start_date: string
  end_date: string
  purpose: string
  estimated_cost: number | null
  status: string
  created_at: string
}

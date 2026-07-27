/** POST /rental-reservations のリクエストボディ。 */
export type RentalReservationCreateRequest = {
  item_name: string
  start_date: string
  end_date: string
  purpose: string | null
}

/** GET /rental-reservations/me と /rentals/:id のレスポンス要素。api は snake_case で返す。 */
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

/** PUT /rental-reservations/:id のリクエストボディ。 */
export type RentalReservationUpdateRequest = {
  item_name: string
  start_date: string
  end_date: string
  purpose: string | null
}

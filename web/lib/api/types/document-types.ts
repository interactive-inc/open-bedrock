/** GET /documents の各要素。 */
export type DocumentListItem = {
  id: number
  title: string
  category: string | null
  location: string
  partner_code: string | null
  expires_on: string | null
  note: string | null
  created_at: string
}

/** POST /documents のリクエスト body。 */
export type DocumentRegisterRequest = {
  title: string
  location: string
  category?: string
  partner_code?: string
  expires_on?: string
  note?: string
}

/** PUT /documents/:id のリクエスト body。 */
export type DocumentUpdateRequest = DocumentRegisterRequest

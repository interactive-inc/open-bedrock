/** POST /antisocial-checks のリクエストボディ。所在地・代表者名は任意（記録のみ）。 */
export type AntisocialCheckCreateRequest = {
  partner_name: string
  partner_address: string | null
  representative_name: string | null
}

/** PUT /antisocial-checks/:id のリクエストボディ。result は判定結果（任意）。 */
export type AntisocialCheckUpdateRequest = {
  partner_name: string
  partner_address: string | null
  representative_name: string | null
  result: string | null
}

/** GET /antisocial-checks/me と /antisocial-checks/:id のレスポンス要素。api は snake_case で返す。 */
export type AntisocialCheckResponse = {
  id: string
  requester_id: number
  partner_name: string
  partner_address: string | null
  representative_name: string | null
  result: string | null
  status: string
  created_at: string
}

export type AntisocialCheckAdminResponse = AntisocialCheckResponse & {
  requester_name: string
}
